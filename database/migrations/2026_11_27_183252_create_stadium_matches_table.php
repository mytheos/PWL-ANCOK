<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stadium_matches', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('home_team');
            $table->string('home_short', 8);
            $table->string('home_color', 16);
            $table->string('away_team');
            $table->string('away_short', 8);
            $table->string('away_color', 16);
            $table->string('competition');
            $table->string('stadium_name');
            $table->string('city');
            $table->string('kickoff_label');
            $table->dateTime('kickoff_at');
            $table->boolean('is_featured')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stadium_matches');
    }
};
