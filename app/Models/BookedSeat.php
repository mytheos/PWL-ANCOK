<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookedSeat extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'booking_id',
        'stadium_match_id',
        'sector_code',
        'row_number',
        'seat_number',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'row_number' => 'integer',
            'seat_number' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Booking, $this>
     */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /**
     * @return BelongsTo<StadiumMatch, $this>
     */
    public function match(): BelongsTo
    {
        return $this->belongsTo(StadiumMatch::class, 'stadium_match_id');
    }
}
