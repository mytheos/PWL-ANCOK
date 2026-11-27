@extends('layouts.app')

@section('title', 'Riwayat Pemesanan Tiket')
@section('bookings_count', (string) count($bookings))

@section('content')
<div class="py-8 px-4 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-4xl">
        <div class="mb-5 flex items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-navy-950">Riwayat Tiket Elektronik</h1>
                <p class="text-xs text-ink-muted mt-0.5">Daftar tiket kursi stadion yang sudah diterbitkan pada sesi atau basis data ini.</p>
            </div>
            <a href="{{ route('ticketing.index') }}" class="rounded-lg bg-navy-900 hover:bg-navy-800 text-white px-3.5 py-2 text-xs font-semibold transition shrink-0">
                Pesan Kursi Lagi
            </a>
        </div>

        @if($bookings === [])
            <div class="rounded-2xl bg-white border border-slate-200 p-8 text-center">
                <p class="text-sm font-semibold text-ink">Belum ada tiket yang dipesan.</p>
                <p class="text-xs text-ink-muted mt-1">Pilih sektor pada peta stadion dan lihat sudut pandang tiga dimensi sebelum memesan.</p>
                <a href="{{ route('ticketing.index') }}" class="mt-4 inline-flex items-center justify-center rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 px-4 py-2 text-xs font-bold uppercase tracking-wider transition">
                    Buka Peta Stadion
                </a>
            </div>
        @else
            <div class="space-y-3">
                @foreach($bookings as $item)
                    <a href="{{ route('bookings.show', ['bookingCode' => $item['booking_code']]) }}" class="block rounded-xl bg-white border border-slate-200 hover:border-navy-700 p-4 shadow-xs transition">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <span class="text-xs font-bold font-mono text-gold-600">{{ $item['booking_code'] }}</span>
                                <h2 class="text-sm font-bold text-navy-950 mt-0.5">
                                    {{ $item['match']['home_team'] }} vs {{ $item['match']['away_team'] }}
                                </h2>
                            </div>
                            <span class="text-sm font-bold text-navy-900 tabular-nums">
                                Rp {{ number_format($item['total_price'], 0, ',', '.') }}
                            </span>
                        </div>
                        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                            <span>Sektor {{ $item['sector']['code'] }} ({{ $item['sector']['name'] }})</span>
                            <span>·</span>
                            <span>Pintu {{ $item['sector']['access_gate'] }}</span>
                            <span>·</span>
                            <span>Baris {{ $item['seats'][0]['row_number'] }} · Kursi {{ collect($item['seats'])->pluck('seat_number')->implode(', ') }}</span>
                        </div>
                    </a>
                @endforeach
            </div>
        @endif
    </div>
</div>
@endsection
