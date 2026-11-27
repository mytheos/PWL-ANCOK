<?php

namespace Database\Seeders;

use App\Models\BookedSeat;
use App\Models\Booking;
use App\Models\StadiumMatch;
use App\Models\StadiumSector;
use App\Support\StadiumCatalogData;
use Illuminate\Database\Seeder;

class StadiumSeeder extends Seeder
{
    public function run(): void
    {
        foreach (StadiumCatalogData::matches() as $matchData) {
            $match = StadiumMatch::query()->updateOrCreate(
                ['slug' => $matchData['slug']],
                collect($matchData)->except('id')->all(),
            );

            foreach (StadiumCatalogData::sectorsForMatch((int) $matchData['id']) as $sectorData) {
                StadiumSector::query()->updateOrCreate(
                    [
                        'stadium_match_id' => $match->id,
                        'code' => $sectorData['code'],
                    ],
                    collect($sectorData)->except(['id', 'stadium_match_id'])->all(),
                );
            }

            if ($match->bookings()->doesntExist()) {
                $sampleSector = $match->sectors()->where('code', '05')->first() ?? $match->sectors()->first();

                if ($sampleSector !== null) {
                    $booking = Booking::query()->create([
                        'booking_code' => 'TKT-DEMO0'.$match->id,
                        'stadium_match_id' => $match->id,
                        'stadium_sector_id' => $sampleSector->id,
                        'buyer_name' => 'Penonton Terdaftar',
                        'buyer_email' => 'penonton'.$match->id.'@contoh.id',
                        'buyer_phone' => '08120000000'.$match->id,
                        'payment_method' => 'Transfer Bank Virtual',
                        'ticket_count' => 1,
                        'unit_price' => $sampleSector->price,
                        'service_fee' => 10000,
                        'total_price' => $sampleSector->price + 10000,
                        'status' => 'paid',
                    ]);

                    BookedSeat::query()->create([
                        'booking_id' => $booking->id,
                        'stadium_match_id' => $match->id,
                        'sector_code' => '05',
                        'row_number' => 19,
                        'seat_number' => 14,
                    ]);
                }
            }
        }
    }
}
