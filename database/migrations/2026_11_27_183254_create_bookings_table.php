<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table): void {
            $table->id();
            $table->string('booking_code', 24)->unique();
            $table->foreignId('stadium_match_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stadium_sector_id')->constrained()->cascadeOnDelete();
            $table->string('buyer_name');
            $table->string('buyer_email');
            $table->string('buyer_phone', 32);
            $table->string('payment_method', 40);
            $table->unsignedSmallInteger('ticket_count');
            $table->unsignedInteger('unit_price');
            $table->unsignedInteger('service_fee');
            $table->unsignedInteger('total_price');
            $table->string('status', 24)->default('paid');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
