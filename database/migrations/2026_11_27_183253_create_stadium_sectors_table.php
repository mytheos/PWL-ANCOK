<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stadium_sectors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('stadium_match_id')->constrained()->cascadeOnDelete();
            $table->string('code', 4);
            $table->string('name');
            $table->string('tier_label');
            $table->string('access_gate', 16);
            $table->unsignedInteger('price');
            $table->unsignedSmallInteger('rows_count');
            $table->unsignedSmallInteger('seats_per_row');
            $table->float('angle_start');
            $table->float('angle_end');
            $table->timestamps();

            $table->unique(['stadium_match_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stadium_sectors');
    }
};
