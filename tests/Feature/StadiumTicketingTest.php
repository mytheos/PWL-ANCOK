<?php

namespace Tests\Feature;

use App\Support\StadiumCatalogData;
use Tests\TestCase;

class StadiumTicketingTest extends TestCase
{
    public function test_stadium_ticketing_home_renders_featured_match_and_controls(): void
    {
        $response = $this->get(route('ticketing.index'));

        $response->assertOk();
        $response->assertSee('PERSIJA');
        $response->assertSee('PERSIB');
        $response->assertSee('Fokus Sudut Pandang Tiga Dimensi');
        $response->assertSee('Bayar Sekarang');
    }

    public function test_switching_match_updates_active_match_header(): void
    {
        $response = $this->get(route('ticketing.index', ['pertandingan' => 'indonesia-vs-jepang']));

        $response->assertOk();
        $response->assertSee('INDONESIA');
        $response->assertSee('JEPANG');
    }

    public function test_booking_creates_electronic_ticket_and_prevents_double_booking(): void
    {
        $occupied = collect(StadiumCatalogData::initialOccupiedSeats(1))
            ->map(static fn (array $seat): string => "{$seat['sector_code']}-{$seat['row_number']}-{$seat['seat_number']}")
            ->flip();

        $freeSeat = 1;
        while ($occupied->has("05-19-{$freeSeat}")) {
            $freeSeat++;
        }

        $payload = [
            'match_slug' => 'persija-vs-persib',
            'sector_code' => '05',
            'row_number' => 19,
            'seat_number' => $freeSeat,
            'ticket_count' => 1,
            'buyer_name' => 'Theo Pratama',
            'buyer_email' => 'theo@contoh.id',
            'buyer_phone' => '081234567890',
            'payment_method' => 'Transfer Bank Virtual',
        ];

        $createResponse = $this->postJson(route('bookings.store'), $payload);

        $createResponse->assertCreated();
        $createResponse->assertJsonPath('booking.sector.code', '05');
        $createResponse->assertJsonPath('booking.total_price', 460000);

        $bookingCode = $createResponse->json('booking.booking_code');

        $this->get(route('bookings.show', ['bookingCode' => $bookingCode]))
            ->assertOk()
            ->assertSee($bookingCode)
            ->assertSee('Theo Pratama')
            ->assertSee('Tribun Timur Tengah');

        $this->get(route('bookings.index'))
            ->assertOk()
            ->assertSee($bookingCode);

        $duplicateResponse = $this->postJson(route('bookings.store'), $payload);

        $duplicateResponse->assertUnprocessable();
        $duplicateResponse->assertJsonValidationErrors(['seat_number']);
    }

    public function test_booking_validates_buyer_fields_and_unknown_ticket_returns_not_found(): void
    {
        $this->postJson(route('bookings.store'), [
            'match_slug' => 'persija-vs-persib',
            'sector_code' => '05',
            'row_number' => 19,
            'seat_number' => 1,
            'ticket_count' => 1,
            'buyer_name' => '',
            'buyer_email' => 'bukan-surel',
            'buyer_phone' => '123',
            'payment_method' => 'Tunai',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['buyer_name', 'buyer_email', 'buyer_phone', 'payment_method']);

        $this->get(route('bookings.show', ['bookingCode' => 'TKT-TIDAKADA']))
            ->assertNotFound();
    }
}
