<?php

namespace Database\Factories;

use App\Models\StadiumMatch;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<StadiumMatch>
 */
class StadiumMatchFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $home = strtoupper($this->faker->city());
        $away = strtoupper($this->faker->city());

        return [
            'slug' => Str::slug($home.'-vs-'.$away.'-'.$this->faker->unique()->numberBetween(100, 999)),
            'home_team' => $home,
            'home_short' => strtoupper(substr($home, 0, 3)),
            'home_color' => '#D92D20',
            'away_team' => $away,
            'away_short' => strtoupper(substr($away, 0, 3)),
            'away_color' => '#1D4ED8',
            'competition' => 'Liga Nusantara',
            'stadium_name' => 'Stadion Utama Gelora Bung Karno',
            'city' => 'Jakarta',
            'kickoff_label' => 'Sabtu, 12 Desember 2026 · 19:30 WIB',
            'kickoff_at' => now()->addDays(14),
            'is_featured' => false,
        ];
    }
}
