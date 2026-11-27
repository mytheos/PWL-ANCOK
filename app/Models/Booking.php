<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Booking extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'booking_code',
        'stadium_match_id',
        'stadium_sector_id',
        'buyer_name',
        'buyer_email',
        'buyer_phone',
        'payment_method',
        'ticket_count',
        'unit_price',
        'service_fee',
        'total_price',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ticket_count' => 'integer',
            'unit_price' => 'integer',
            'service_fee' => 'integer',
            'total_price' => 'integer',
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
     * @return BelongsTo<StadiumSector, $this>
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(StadiumSector::class, 'stadium_sector_id');
    }

    /**
     * @return HasMany<BookedSeat, $this>
     */
    public function seats(): HasMany
    {
        return $this->hasMany(BookedSeat::class)->orderBy('seat_number');
    }
}
