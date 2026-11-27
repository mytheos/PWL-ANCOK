<?php

namespace App\Services;

use App\Models\BookedSeat;
use App\Models\Booking;
use App\Models\StadiumMatch;
use App\Support\StadiumCatalogData;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class StadiumTicketingService
{
    private const int SERVICE_FEE = 10000;

    private ?bool $databaseAvailable = null;

    public function isDatabaseReady(): bool
    {
        if ($this->databaseAvailable !== null) {
            return $this->databaseAvailable;
        }

        try {
            $ready = Schema::hasTable('stadium_matches')
                && Schema::hasTable('stadium_sectors')
                && Schema::hasTable('bookings')
                && Schema::hasTable('booked_seats')
                && StadiumMatch::query()->exists();

            $this->databaseAvailable = $ready;
        } catch (Throwable) {
            $this->databaseAvailable = false;
        }

        return $this->databaseAvailable;
    }

    /**
     * @return array{
     *     matches: list<array<string, mixed>>,
     *     activeMatch: array<string, mixed>,
     *     sectors: list<array<string, mixed>>,
     *     occupiedSeats: array<string, true>,
     *     recentBookings: list<array<string, mixed>>,
     *     storageMode: string,
     * }
     */
    public function getTicketingState(?string $matchSlug = null): array
    {
        if ($this->isDatabaseReady()) {
            $matches = StadiumMatch::query()
                ->orderByDesc('is_featured')
                ->orderBy('kickoff_at')
                ->get();

            $activeModel = $matches->firstWhere('slug', $matchSlug) ?? $matches->firstOrFail();
            $activeModel->load(['sectors', 'bookedSeats']);

            $occupiedSeats = [];
            foreach (StadiumCatalogData::initialOccupiedSeats($activeModel->id) as $seat) {
                $occupiedSeats[$this->seatKey($seat['sector_code'], $seat['row_number'], $seat['seat_number'])] = true;
            }
            foreach ($activeModel->bookedSeats as $bookedSeat) {
                $occupiedSeats[$this->seatKey($bookedSeat->sector_code, $bookedSeat->row_number, $bookedSeat->seat_number)] = true;
            }

            return [
                'matches' => $matches->map(fn (StadiumMatch $match): array => $this->formatMatch($match))->values()->all(),
                'activeMatch' => $this->formatMatch($activeModel),
                'sectors' => $activeModel->sectors->map(static fn ($sector): array => [
                    'id' => $sector->id,
                    'code' => $sector->code,
                    'name' => $sector->name,
                    'tier_label' => $sector->tier_label,
                    'access_gate' => $sector->access_gate,
                    'price' => $sector->price,
                    'rows_count' => $sector->rows_count,
                    'seats_per_row' => $sector->seats_per_row,
                    'angle_start' => $sector->angle_start,
                    'angle_end' => $sector->angle_end,
                ])->values()->all(),
                'occupiedSeats' => $occupiedSeats,
                'recentBookings' => $this->getRecentBookings(),
                'storageMode' => 'database',
            ];
        }

        $matches = StadiumCatalogData::matches();
        $activeMatch = collect($matches)->firstWhere('slug', $matchSlug) ?? $matches[0];
        $sectors = StadiumCatalogData::sectorsForMatch((int) $activeMatch['id']);

        $occupiedSeats = [];
        foreach (StadiumCatalogData::initialOccupiedSeats((int) $activeMatch['id']) as $seat) {
            $occupiedSeats[$this->seatKey($seat['sector_code'], $seat['row_number'], $seat['seat_number'])] = true;
        }

        foreach ($this->getSessionBookings() as $booking) {
            if ((int) ($booking['match']['id'] ?? 0) !== (int) $activeMatch['id']) {
                continue;
            }

            foreach ($booking['seats'] ?? [] as $seat) {
                $occupiedSeats[$this->seatKey(
                    (string) $seat['sector_code'],
                    (int) $seat['row_number'],
                    (int) $seat['seat_number'],
                )] = true;
            }
        }

        return [
            'matches' => $matches,
            'activeMatch' => $activeMatch,
            'sectors' => $sectors,
            'occupiedSeats' => $occupiedSeats,
            'recentBookings' => $this->getRecentBookings(),
            'storageMode' => 'session',
        ];
    }

    /**
     * @param  array{
     *     match_slug: string,
     *     sector_code: string,
     *     row_number: int,
     *     seat_number: int,
     *     ticket_count: int,
     *     buyer_name: string,
     *     buyer_email: string,
     *     buyer_phone: string,
     *     payment_method: string,
     * }  $payload
     * @return array<string, mixed>
     */
    public function createBooking(array $payload): array
    {
        $state = $this->getTicketingState($payload['match_slug']);
        $match = $state['activeMatch'];

        if ($match['slug'] !== $payload['match_slug']) {
            throw ValidationException::withMessages([
                'match_slug' => 'Pertandingan yang dipilih tidak ditemukan.',
            ]);
        }

        $sector = collect($state['sectors'])->firstWhere('code', $payload['sector_code']);
        if ($sector === null) {
            throw ValidationException::withMessages([
                'sector_code' => 'Sektor tribun yang dipilih tidak tersedia.',
            ]);
        }

        $ticketCount = (int) $payload['ticket_count'];
        $rowNumber = (int) $payload['row_number'];
        $startSeat = (int) $payload['seat_number'];
        $endSeat = $startSeat + $ticketCount - 1;

        if ($rowNumber < 1 || $rowNumber > (int) $sector['rows_count']) {
            throw ValidationException::withMessages([
                'row_number' => 'Nomor baris di luar kapasitas sektor ini.',
            ]);
        }

        if ($startSeat < 1 || $endSeat > (int) $sector['seats_per_row']) {
            throw ValidationException::withMessages([
                'seat_number' => 'Nomor kursi tidak mencukupi untuk jumlah tiket bersebelahan yang dipilih.',
            ]);
        }

        $seatNumbers = range($startSeat, $endSeat);
        foreach ($seatNumbers as $seatNumber) {
            $key = $this->seatKey((string) $sector['code'], $rowNumber, $seatNumber);
            if (isset($state['occupiedSeats'][$key])) {
                throw ValidationException::withMessages([
                    'seat_number' => "Kursi nomor {$seatNumber} pada baris {$rowNumber} sudah terjual. Silakan pilih kursi lain.",
                ]);
            }
        }

        $unitPrice = (int) $sector['price'];
        $totalPrice = ($unitPrice * $ticketCount) + self::SERVICE_FEE;
        $bookingCode = 'TKT-'.strtoupper(Str::random(6));

        if ($this->isDatabaseReady()) {
            try {
                $bookingModel = DB::transaction(function () use (
                    $payload,
                    $match,
                    $sector,
                    $seatNumbers,
                    $rowNumber,
                    $ticketCount,
                    $unitPrice,
                    $totalPrice,
                    $bookingCode,
                ): Booking {
                    $alreadyTaken = BookedSeat::query()
                        ->where('stadium_match_id', $match['id'])
                        ->where('sector_code', $sector['code'])
                        ->where('row_number', $rowNumber)
                        ->whereIn('seat_number', $seatNumbers)
                        ->lockForUpdate()
                        ->exists();

                    if ($alreadyTaken) {
                        throw ValidationException::withMessages([
                            'seat_number' => 'Kursi yang dipilih baru saja dipesan oleh penonton lain.',
                        ]);
                    }

                    $booking = Booking::query()->create([
                        'booking_code' => $bookingCode,
                        'stadium_match_id' => $match['id'],
                        'stadium_sector_id' => $sector['id'],
                        'buyer_name' => $payload['buyer_name'],
                        'buyer_email' => $payload['buyer_email'],
                        'buyer_phone' => $payload['buyer_phone'],
                        'payment_method' => $payload['payment_method'],
                        'ticket_count' => $ticketCount,
                        'unit_price' => $unitPrice,
                        'service_fee' => self::SERVICE_FEE,
                        'total_price' => $totalPrice,
                        'status' => 'paid',
                    ]);

                    foreach ($seatNumbers as $seatNumber) {
                        BookedSeat::query()->create([
                            'booking_id' => $booking->id,
                            'stadium_match_id' => $match['id'],
                            'sector_code' => $sector['code'],
                            'row_number' => $rowNumber,
                            'seat_number' => $seatNumber,
                        ]);
                    }

                    return $booking->load(['match', 'sector', 'seats']);
                });

                $formatted = $this->formatDatabaseBooking($bookingModel);
                $this->rememberSessionBooking($formatted);

                return $formatted;
            } catch (UniqueConstraintViolationException) {
                throw ValidationException::withMessages([
                    'seat_number' => 'Kursi yang dipilih baru saja dipesan oleh penonton lain.',
                ]);
            }
        }

        $booking = [
            'booking_code' => $bookingCode,
            'buyer_name' => $payload['buyer_name'],
            'buyer_email' => $payload['buyer_email'],
            'buyer_phone' => $payload['buyer_phone'],
            'payment_method' => $payload['payment_method'],
            'ticket_count' => $ticketCount,
            'unit_price' => $unitPrice,
            'service_fee' => self::SERVICE_FEE,
            'total_price' => $totalPrice,
            'status' => 'paid',
            'created_at_label' => now()->format('d M Y · H:i').' WIB',
            'match' => $match,
            'sector' => $sector,
            'seats' => array_map(
                static fn (int $seatNumber): array => [
                    'sector_code' => (string) $sector['code'],
                    'row_number' => $rowNumber,
                    'seat_number' => $seatNumber,
                ],
                $seatNumbers,
            ),
        ];

        $this->rememberSessionBooking($booking);

        return $booking;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findBooking(string $bookingCode): ?array
    {
        $normalized = strtoupper(trim($bookingCode));

        if ($this->isDatabaseReady()) {
            $booking = Booking::query()
                ->with(['match', 'sector', 'seats'])
                ->where('booking_code', $normalized)
                ->first();

            if ($booking !== null) {
                return $this->formatDatabaseBooking($booking);
            }
        }

        return collect($this->getSessionBookings())
            ->firstWhere('booking_code', $normalized);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function getRecentBookings(): array
    {
        if ($this->isDatabaseReady()) {
            $sessionCodes = collect($this->getSessionBookings())->pluck('booking_code')->all();

            $bookings = Booking::query()
                ->with(['match', 'sector', 'seats'])
                ->when(
                    $sessionCodes !== [],
                    static fn ($query) => $query->whereIn('booking_code', $sessionCodes),
                    static fn ($query) => $query->latest()->limit(6),
                )
                ->latest()
                ->limit(10)
                ->get();

            return $bookings->map(fn (Booking $booking): array => $this->formatDatabaseBooking($booking))->values()->all();
        }

        return $this->getSessionBookings();
    }

    private function seatKey(string $sectorCode, int $rowNumber, int $seatNumber): string
    {
        return sprintf('%s-%d-%d', $sectorCode, $rowNumber, $seatNumber);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function getSessionBookings(): array
    {
        $bookings = session()->get('stadium_bookings', []);

        return is_array($bookings) ? array_values($bookings) : [];
    }

    /**
     * @param  array<string, mixed>  $booking
     */
    private function rememberSessionBooking(array $booking): void
    {
        $existing = collect($this->getSessionBookings())
            ->reject(static fn (array $item): bool => ($item['booking_code'] ?? '') === $booking['booking_code'])
            ->prepend($booking)
            ->take(10)
            ->values()
            ->all();

        session()->put('stadium_bookings', $existing);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatMatch(StadiumMatch $match): array
    {
        return [
            'id' => $match->id,
            'slug' => $match->slug,
            'home_team' => $match->home_team,
            'home_short' => $match->home_short,
            'home_color' => $match->home_color,
            'away_team' => $match->away_team,
            'away_short' => $match->away_short,
            'away_color' => $match->away_color,
            'competition' => $match->competition,
            'stadium_name' => $match->stadium_name,
            'city' => $match->city,
            'kickoff_label' => $match->kickoff_label,
            'kickoff_at' => $match->kickoff_at?->toIso8601String(),
            'is_featured' => $match->is_featured,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatDatabaseBooking(Booking $booking): array
    {
        return [
            'booking_code' => $booking->booking_code,
            'buyer_name' => $booking->buyer_name,
            'buyer_email' => $booking->buyer_email,
            'buyer_phone' => $booking->buyer_phone,
            'payment_method' => $booking->payment_method,
            'ticket_count' => $booking->ticket_count,
            'unit_price' => $booking->unit_price,
            'service_fee' => $booking->service_fee,
            'total_price' => $booking->total_price,
            'status' => $booking->status,
            'created_at_label' => $booking->created_at?->format('d M Y · H:i').' WIB',
            'match' => $this->formatMatch($booking->match),
            'sector' => [
                'id' => $booking->sector->id,
                'code' => $booking->sector->code,
                'name' => $booking->sector->name,
                'tier_label' => $booking->sector->tier_label,
                'access_gate' => $booking->sector->access_gate,
                'price' => $booking->sector->price,
                'rows_count' => $booking->sector->rows_count,
                'seats_per_row' => $booking->sector->seats_per_row,
                'angle_start' => $booking->sector->angle_start,
                'angle_end' => $booking->sector->angle_end,
            ],
            'seats' => $booking->seats->map(static fn (BookedSeat $seat): array => [
                'sector_code' => $seat->sector_code,
                'row_number' => $seat->row_number,
                'seat_number' => $seat->seat_number,
            ])->values()->all(),
        ];
    }
}
