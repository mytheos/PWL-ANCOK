<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StadiumSector extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'stadium_match_id',
        'code',
        'name',
        'tier_label',
        'access_gate',
        'price',
        'rows_count',
        'seats_per_row',
        'angle_start',
        'angle_end',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'rows_count' => 'integer',
            'seats_per_row' => 'integer',
            'angle_start' => 'float',
            'angle_end' => 'float',
        ];
    }

    /**
     * @return BelongsTo<StadiumMatch, $this>
     */
    public function match(): BelongsTo
    {
        return $this->belongsTo(StadiumMatch::class, 'stadium_match_id');
    }

    /**
     * @return HasMany<Booking, $this>
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }
}
