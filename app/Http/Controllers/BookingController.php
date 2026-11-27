<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreBookingRequest;
use App\Services\StadiumTicketingService;
use Illuminate\Http\JsonResponse;
use Illuminate\View\View;

class BookingController extends Controller
{
    public function __construct(
        private readonly StadiumTicketingService $ticketingService,
    ) {}

    public function index(): View
    {
        return view('ticketing.history', [
            'bookings' => $this->ticketingService->getRecentBookings(),
        ]);
    }

    public function store(StoreBookingRequest $request): JsonResponse
    {
        $booking = $this->ticketingService->createBooking($request->validated());

        return response()->json([
            'message' => 'Tiket elektronik berhasil diterbitkan.',
            'booking' => $booking,
            'ticket_url' => route('bookings.show', ['bookingCode' => $booking['booking_code']]),
        ], 201);
    }

    public function show(string $bookingCode): View
    {
        $booking = $this->ticketingService->findBooking($bookingCode);

        abort_if($booking === null, 404);

        return view('ticketing.ticket', [
            'booking' => $booking,
        ]);
    }
}
