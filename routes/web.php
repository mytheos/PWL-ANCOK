<?php

use App\Http\Controllers\BookingController;
use App\Http\Controllers\TicketingController;
use Illuminate\Support\Facades\Route;

Route::get('/', [TicketingController::class, 'index'])->name('ticketing.index');
Route::get('/tiket', [BookingController::class, 'index'])->name('bookings.index');
Route::post('/pemesanan', [BookingController::class, 'store'])->name('bookings.store');
Route::get('/tiket/{bookingCode}', [BookingController::class, 'show'])->name('bookings.show');
