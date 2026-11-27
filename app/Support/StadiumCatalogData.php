<?php

namespace App\Support;

final class StadiumCatalogData
{
    /**
     * @return list<array<string, mixed>>
     */
    public static function matches(): array
    {
        return [
            [
                'id' => 1,
                'slug' => 'persija-vs-persib',
                'home_team' => 'PERSIJA',
                'home_short' => 'PRJ',
                'home_color' => '#D92D20',
                'away_team' => 'PERSIB',
                'away_short' => 'PSB',
                'away_color' => '#1D4ED8',
                'competition' => 'Liga Nusantara · Pekan 18',
                'stadium_name' => 'Stadion Utama Gelora Bung Karno',
                'city' => 'Jakarta',
                'kickoff_label' => 'Sabtu, 12 Desember 2026 · 19:30 WIB',
                'kickoff_at' => '2026-12-12 19:30:00',
                'is_featured' => true,
            ],
            [
                'id' => 2,
                'slug' => 'indonesia-vs-jepang',
                'home_team' => 'INDONESIA',
                'home_short' => 'IDN',
                'home_color' => '#C81E1E',
                'away_team' => 'JEPANG',
                'away_short' => 'JPN',
                'away_color' => '#1E3A8A',
                'competition' => 'Kualifikasi Piala Dunia Zona Asia',
                'stadium_name' => 'Stadion Utama Gelora Bung Karno',
                'city' => 'Jakarta',
                'kickoff_label' => 'Selasa, 15 Desember 2026 · 19:00 WIB',
                'kickoff_at' => '2026-12-15 19:00:00',
                'is_featured' => false,
            ],
            [
                'id' => 3,
                'slug' => 'arema-vs-persebaya',
                'home_team' => 'AREMA FC',
                'home_short' => 'ARM',
                'home_color' => '#1D4ED8',
                'away_team' => 'PERSEBAYA',
                'away_short' => 'PBY',
                'away_color' => '#15803D',
                'competition' => 'Liga Nusantara · Derbi Jawa Timur',
                'stadium_name' => 'Stadion Gelora Bung Tomo',
                'city' => 'Surabaya',
                'kickoff_label' => 'Minggu, 20 Desember 2026 · 15:30 WIB',
                'kickoff_at' => '2026-12-20 15:30:00',
                'is_featured' => false,
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function baseSectors(): array
    {
        return [
            [
                'code' => '01',
                'name' => 'Tribun Utara Barat',
                'tier_label' => 'Kategori 3 · Sudut Utara',
                'access_gate' => '104',
                'price' => 200000,
                'rows_count' => 18,
                'seats_per_row' => 28,
                'angle_start' => -45.0,
                'angle_end' => -18.0,
            ],
            [
                'code' => '02',
                'name' => 'Tribun Utara Utama',
                'tier_label' => 'Kategori 3 · Belakang Gawang',
                'access_gate' => '108',
                'price' => 175000,
                'rows_count' => 18,
                'seats_per_row' => 32,
                'angle_start' => -18.0,
                'angle_end' => 18.0,
            ],
            [
                'code' => '03',
                'name' => 'Tribun Utara Timur',
                'tier_label' => 'Kategori 3 · Sudut Utara',
                'access_gate' => '112',
                'price' => 200000,
                'rows_count' => 18,
                'seats_per_row' => 28,
                'angle_start' => 18.0,
                'angle_end' => 45.0,
            ],
            [
                'code' => '04',
                'name' => 'Tribun Timur Utara',
                'tier_label' => 'Kategori 2 · Sisi Timur',
                'access_gate' => '216',
                'price' => 350000,
                'rows_count' => 22,
                'seats_per_row' => 32,
                'angle_start' => 45.0,
                'angle_end' => 72.0,
            ],
            [
                'code' => '05',
                'name' => 'Tribun Timur Tengah',
                'tier_label' => 'Kategori 1 · Garis Tengah',
                'access_gate' => '328',
                'price' => 450000,
                'rows_count' => 22,
                'seats_per_row' => 36,
                'angle_start' => 72.0,
                'angle_end' => 108.0,
            ],
            [
                'code' => '06',
                'name' => 'Tribun Timur Selatan',
                'tier_label' => 'Kategori 2 · Sisi Timur',
                'access_gate' => '224',
                'price' => 350000,
                'rows_count' => 22,
                'seats_per_row' => 32,
                'angle_start' => 108.0,
                'angle_end' => 135.0,
            ],
            [
                'code' => '07',
                'name' => 'Tribun Selatan Timur',
                'tier_label' => 'Kategori 3 · Sudut Selatan',
                'access_gate' => '128',
                'price' => 200000,
                'rows_count' => 18,
                'seats_per_row' => 28,
                'angle_start' => 135.0,
                'angle_end' => 162.0,
            ],
            [
                'code' => '08',
                'name' => 'Tribun Selatan Utama',
                'tier_label' => 'Kategori 3 · Belakang Gawang',
                'access_gate' => '132',
                'price' => 175000,
                'rows_count' => 18,
                'seats_per_row' => 32,
                'angle_start' => 162.0,
                'angle_end' => 198.0,
            ],
            [
                'code' => '09',
                'name' => 'Tribun Selatan Barat',
                'tier_label' => 'Kategori 3 · Sudut Selatan',
                'access_gate' => '136',
                'price' => 200000,
                'rows_count' => 18,
                'seats_per_row' => 28,
                'angle_start' => 198.0,
                'angle_end' => 225.0,
            ],
            [
                'code' => '10',
                'name' => 'Tribun Barat Selatan',
                'tier_label' => 'Utama · Sisi Barat',
                'access_gate' => '402',
                'price' => 650000,
                'rows_count' => 20,
                'seats_per_row' => 30,
                'angle_start' => 225.0,
                'angle_end' => 252.0,
            ],
            [
                'code' => '11',
                'name' => 'Tribun Barat Kehormatan',
                'tier_label' => 'Kelas Kehormatan · Tengah',
                'access_gate' => '401',
                'price' => 850000,
                'rows_count' => 20,
                'seats_per_row' => 32,
                'angle_start' => 252.0,
                'angle_end' => 288.0,
            ],
            [
                'code' => '12',
                'name' => 'Tribun Barat Utara',
                'tier_label' => 'Utama · Sisi Barat',
                'access_gate' => '403',
                'price' => 650000,
                'rows_count' => 20,
                'seats_per_row' => 30,
                'angle_start' => 288.0,
                'angle_end' => 315.0,
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function sectorsForMatch(int $matchId): array
    {
        $multiplier = match ($matchId) {
            2 => 1.2,
            3 => 0.9,
            default => 1.0,
        };

        return array_map(
            static function (array $sector, int $index) use ($matchId, $multiplier): array {
                $adjustedPrice = (int) (round(($sector['price'] * $multiplier) / 5000) * 5000);

                return [
                    ...$sector,
                    'id' => ($matchId * 100) + $index + 1,
                    'stadium_match_id' => $matchId,
                    'price' => $adjustedPrice,
                ];
            },
            self::baseSectors(),
            array_keys(self::baseSectors()),
        );
    }

    /**
     * Deterministic sample sold seats so users immediately see realistic availability per row.
     *
     * @return list<array{sector_code: string, row_number: int, seat_number: int}>
     */
    public static function initialOccupiedSeats(int $matchId): array
    {
        $occupied = [];

        foreach (self::baseSectors() as $sectorIndex => $sector) {
            $code = $sector['code'];
            $rows = $sector['rows_count'];
            $seatsPerRow = $sector['seats_per_row'];

            for ($row = 1; $row <= $rows; $row++) {
                for ($seat = 1; $seat <= $seatsPerRow; $seat++) {
                    $hash = (($matchId * 73) + ($sectorIndex * 37) + ($row * 19) + ($seat * 11)) % 17;
                    if ($hash === 0 || $hash === 5) {
                        $occupied[] = [
                            'sector_code' => $code,
                            'row_number' => $row,
                            'seat_number' => $seat,
                        ];
                    }
                }
            }
        }

        return $occupied;
    }
}
