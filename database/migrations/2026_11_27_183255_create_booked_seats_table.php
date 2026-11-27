<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booked_seats', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stadium_match_id')->constrained()->cascadeOnDelete();
            $table->string('sector_code', 4);
            $table->unsignedSmallInteger('row_number');
            $table->unsignedSmallInteger('seat_number');
            $table->timestamps();

            $table->unique(
                ['stadium_match_id', 'sector_code', 'row_number', 'seat_number'],
                'unique_match_sector_row_seat',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booked_seats');
    }
};
