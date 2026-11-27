<?php

namespace App\Http\Controllers;

use App\Services\StadiumTicketingService;
use Illuminate\Http\Request;
use Illuminate\View\View;

class TicketingController extends Controller
{
    public function __construct(
        private readonly StadiumTicketingService $ticketingService,
    ) {}

    public function index(Request $request): View
    {
        $matchSlug = $request->query('pertandingan');
        $state = $this->ticketingService->getTicketingState(
            is_string($matchSlug) ? $matchSlug : null,
        );

        return view('ticketing.index', [
            'state' => $state,
        ]);
    }
}
