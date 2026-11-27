@extends('layouts.app')

@section('title', 'Tiket Elektronik '.$booking['booking_code'])

@section('content')
<div class="py-8 px-4">
    <div class="mx-auto max-w-lg">
        <div class="no-print mb-4 flex items-center justify-between">
            <a href="{{ route('ticketing.index', ['pertandingan' => $booking['match']['slug']]) }}" class="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-800 hover:underline">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Kembali ke Peta Stadion</span>
            </a>
            <button
                type="button"
                onclick="window.print()"
                class="rounded-lg bg-navy-900 hover:bg-navy-800 text-white px-3.5 py-2 text-xs font-semibold transition"
            >
                Cetak Tiket
            </button>
        </div>

        <article class="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-navy-950/10 overflow-hidden">
            <header class="bg-navy-950 text-white px-6 py-5">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-[11px] font-bold tracking-[0.18em] uppercase text-gold-400">Tiket Elektronik Resmi</span>
                    <span class="rounded bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                        Lunas
                    </span>
                </div>
                <h1 class="mt-2 text-xl font-bold tracking-wide">
                    {{ $booking['match']['home_team'] }} vs {{ $booking['match']['away_team'] }}
                </h1>
                <p class="text-xs text-slate-300 mt-1">{{ $booking['match']['kickoff_label'] }}</p>
                <p class="text-xs text-slate-400">{{ $booking['match']['stadium_name'] }}</p>
            </header>

            <div class="p-6 space-y-5">
                <div class="grid grid-cols-3 gap-3">
                    <div class="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <span class="block text-[11px] text-ink-muted">Sektor</span>
                        <span class="mt-0.5 block text-lg font-bold font-mono text-navy-900">{{ $booking['sector']['code'] }}</span>
                    </div>
                    <div class="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <span class="block text-[11px] text-ink-muted">Pintu</span>
                        <span class="mt-0.5 block text-lg font-bold font-mono text-navy-900">{{ $booking['sector']['access_gate'] }}</span>
                    </div>
                    <div class="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <span class="block text-[11px] text-ink-muted">Baris</span>
                        <span class="mt-0.5 block text-lg font-bold font-mono text-navy-900">{{ $booking['seats'][0]['row_number'] }}</span>
                    </div>
                </div>

                <div class="rounded-xl border border-gold-500/40 bg-gold-500/10 p-4">
                    <span class="block text-xs font-semibold text-navy-900">Tribun &amp; Nomor Kursi</span>
                    <p class="mt-1 text-sm font-bold text-navy-950">{{ $booking['sector']['name'] }}</p>
                    <div class="mt-2 flex flex-wrap gap-2">
                        @foreach($booking['seats'] as $seat)
                            <span class="rounded bg-navy-900 text-gold-400 px-2.5 py-1 text-xs font-bold font-mono">
                                Baris {{ $seat['row_number'] }} · Kursi {{ $seat['seat_number'] }}
                            </span>
                        @endforeach
                    </div>
                </div>

                <div class="border-t border-dashed border-slate-300 pt-4 space-y-2 text-xs">
                    <div class="flex justify-between">
                        <span class="text-ink-muted">Kode Pemesanan</span>
                        <span class="font-bold font-mono text-navy-950">{{ $booking['booking_code'] }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-ink-muted">Pemesan</span>
                        <span class="font-semibold text-ink">{{ $booking['buyer_name'] }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-ink-muted">Metode Pembayaran</span>
                        <span class="font-semibold text-ink">{{ $booking['payment_method'] }}</span>
                    </div>
                    <div class="flex justify-between text-sm pt-2 border-t border-slate-100">
                        <span class="font-semibold text-ink">Total Dibayar</span>
                        <span class="font-bold text-gold-600 tabular-nums">Rp {{ number_format($booking['total_price'], 0, ',', '.') }}</span>
                    </div>
                </div>

                {{-- Deterministic visual entry barcode pattern --}}
                <div class="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                    <div class="mx-auto flex items-center justify-center gap-[3px] h-12 max-w-[260px]" aria-hidden="true">
                        @foreach(str_split(sha1($booking['booking_code'])) as $idx => $hex)
                            @php
                                $val = hexdec($hex);
                                $w = ($val % 3) + 1;
                                $h = 28 + (($val + $idx) % 18);
                            @endphp
                            <span class="bg-navy-950 rounded-xs" style="width: {{ $w * 2 }}px; height: {{ $h }}px;"></span>
                        @endforeach
                    </div>
                    <p class="mt-2 text-[11px] font-mono tracking-[0.22em] text-ink-muted uppercase">{{ $booking['booking_code'] }}</p>
                </div>
            </div>
        </article>
    </div>
</div>
@endsection
