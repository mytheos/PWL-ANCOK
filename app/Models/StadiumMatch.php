<?php

namespace App\Models;

use Database\Factories\StadiumMatchFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StadiumMatch extends Model
{
    /** @use HasFactory<StadiumMatchFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'slug',
        'home_team',
        'home_short',
        'home_color',
        'away_team',
        'away_short',
        'away_color',
        'competition',
        'stadium_name',
        'city',
        'kickoff_label',
        'kickoff_at',
        'is_featured',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kickoff_at' => 'datetime',
            'is_featured' => 'boolean',
        ];
    }

    /**
     * @return HasMany<StadiumSector, $this>
     */
    public function sectors(): HasMany
    {
        return $this->hasMany(StadiumSector::class)->orderBy('code');
    }

    /**
     * @return HasMany<Booking, $this>
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /**
     * @return HasMany<BookedSeat, $this>
     */
    public function bookedSeats(): HasMany
    {
        return $this->hasMany(BookedSeat::class);
    }
}
