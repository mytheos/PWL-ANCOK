@extends('layouts.app')

@section('title', $state['activeMatch']['home_team'].' vs '.$state['activeMatch']['away_team'].' — ArenaTiket Stadion 3D')
@section('bookings_count', (string) count($state['recentBookings']))

@section('content')
@php
    $activeMatch = $state['activeMatch'];
    $sectors = $state['sectors'];
    $prices = array_column($sectors, 'price');
    $minPrice = min($prices);
    $maxPrice = max($prices);
@endphp

<div
    id="stadium-app"
    data-state='@json($state)'
    data-booking-url="{{ route('bookings.store') }}"
>
    {{-- Full-Width Hero Match Banner + Match Selector --}}
    <section id="seksi-pertandingan" class="relative bg-navy-950 text-white overflow-hidden">
        <div class="pointer-events-none absolute inset-0 opacity-45" style="background: radial-gradient(circle at 18% 15%, rgba(56, 118, 224, 0.38), transparent 45%), radial-gradient(circle at 82% 20%, rgba(234, 179, 72, 0.22), transparent 42%);"></div>

        <div class="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-16">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {{-- Active Matchup Overview --}}
                <div class="lg:col-span-7">
                    <div class="inline-flex items-center gap-2 rounded-md border border-gold-500/35 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-400">
                        <span>{{ $activeMatch['competition'] }}</span>
                    </div>

                    <div class="mt-5 flex flex-wrap items-center gap-4 sm:gap-6">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-white/20 flex items-center justify-center shadow-lg shrink-0" style="background-color: {{ $activeMatch['home_color'] }}">
                                <span class="font-bold tracking-wider text-sm sm:text-base text-white">{{ $activeMatch['home_short'] }}</span>
                            </div>
                            <span class="text-xl sm:text-2xl font-bold tracking-wide uppercase">{{ $activeMatch['home_team'] }}</span>
                        </div>

                        <span class="text-sm font-bold tracking-[0.2em] text-gold-400 uppercase">vs</span>

                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-white/20 flex items-center justify-center shadow-lg shrink-0" style="background-color: {{ $activeMatch['away_color'] }}">
                                <span class="font-bold tracking-wider text-sm sm:text-base text-white">{{ $activeMatch['away_short'] }}</span>
                            </div>
                            <span class="text-xl sm:text-2xl font-bold tracking-wide uppercase">{{ $activeMatch['away_team'] }}</span>
                        </div>
                    </div>

                    <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-300">
                        <span>{{ $activeMatch['kickoff_label'] }}</span>
                        <span class="text-slate-500">·</span>
                        <span>{{ $activeMatch['stadium_name'] }}, {{ $activeMatch['city'] }}</span>
                    </div>

                    <div class="mt-6 flex flex-wrap items-center gap-3">
                        <a href="#seksi-peta" class="inline-flex items-center justify-center rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition">
                            Pilih Kursi di Peta
                        </a>
                        <a href="#seksi-3d" class="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition">
                            <span>Lihat Stadion Tiga Dimensi</span>
                        </a>
                    </div>
                </div>

                {{-- Direct Match Switcher Cards --}}
                <div class="lg:col-span-5">
                    <div class="rounded-2xl border border-white/10 bg-navy-900/70 p-4">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-bold uppercase tracking-wider text-slate-300">Jadwal Pertandingan Tersedia</span>
                            <span class="text-[11px] text-slate-400">{{ count($state['matches']) }} Laga</span>
                        </div>
                        <div class="space-y-2">
                            @foreach($state['matches'] as $matchItem)
                                <a
                                    href="{{ route('ticketing.index', ['pertandingan' => $matchItem['slug']]) }}"
                                    class="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition {{ $matchItem['slug'] === $activeMatch['slug'] ? 'border-gold-500 bg-gold-500/15 text-white' : 'border-white/10 bg-navy-950/60 text-slate-300 hover:border-white/30 hover:text-white' }}"
                                >
                                    <div class="min-w-0">
                                        <p class="text-xs font-bold truncate">{{ $matchItem['home_team'] }} vs {{ $matchItem['away_team'] }}</p>
                                        <p class="text-[11px] text-slate-400 truncate mt-0.5">{{ $matchItem['kickoff_label'] }}</p>
                                    </div>
                                    @if($matchItem['slug'] === $activeMatch['slug'])
                                        <span class="shrink-0 rounded bg-gold-500 text-navy-950 px-2 py-0.5 text-[10px] font-bold uppercase">Aktif</span>
                                    @else
                                        <span class="shrink-0 text-[11px] font-semibold text-gold-400">Pilih &rarr;</span>
                                    @endif
                                </a>
                            @endforeach
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- SECTION 1: Top-Down Stadium Map & Sector/Seat Selection --}}
    <section id="seksi-peta" class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {{-- Left Column (7 cols): Interactive Top-Down Map + Price Filter --}}
            <div class="lg:col-span-7 rounded-2xl bg-white border border-slate-200/90 shadow-lg shadow-navy-950/5 p-5 sm:p-6 flex flex-col justify-between">
                <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                    <div>
                        <span class="text-[11px] font-bold uppercase tracking-wider text-gold-600">Langkah 1</span>
                        <h2 class="text-lg font-bold text-navy-950">Peta Sektor Stadion</h2>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-ink-muted">
                        <span class="inline-flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded-xs bg-gold-500 inline-block"></span>
                            <span>Sektor Aktif</span>
                        </span>
                        <span class="inline-flex items-center gap-1.5 ml-2">
                            <span class="w-3 h-3 rounded-xs bg-slate-200 border border-slate-300 inline-block"></span>
                            <span>Tersedia</span>
                        </span>
                    </div>
                </div>

                {{-- Centered Top-Down Stadium SVG --}}
                <div class="py-4 flex flex-col items-center justify-center">
                    <div class="w-full max-w-[310px] sm:max-w-[340px] aspect-[360/430]">
                        <svg
                            id="stadium-topdown-svg"
                            viewBox="0 0 360 430"
                            class="w-full h-full select-none"
                            role="img"
                            aria-label="Peta interaktif 12 sektor kursi stadion"
                        ></svg>
                    </div>
                    <p class="mt-1 text-xs text-ink-muted text-center">
                        Klik salah satu nomor sektor (<strong class="font-mono text-navy-900">01</strong> sampai <strong class="font-mono text-navy-900">12</strong>) untuk melihat daftar kursi dan memperbarui sudut pandang tiga dimensi di bawah.
                    </p>
                </div>

                {{-- Price Filter & Ticket Quantity Bar --}}
                <div class="pt-4 border-t border-slate-100">
                    <div class="flex items-center justify-between text-xs font-semibold text-ink mb-1">
                        <span id="filter-min-label" class="tabular-nums">Rp {{ number_format($minPrice, 0, ',', '.') }}</span>
                        <span class="text-[11px] font-medium text-ink-muted">Filter Rentang Harga Sektor</span>
                        <span id="filter-max-label" class="tabular-nums">Rp {{ number_format($maxPrice, 0, ',', '.') }}</span>
                    </div>

                    <div class="range-slider-track">
                        <div class="w-full h-1.5 bg-slate-200 rounded-full relative overflow-hidden">
                            <div id="range-fill-bar" class="absolute inset-y-0 bg-gold-500 rounded-full" style="left: 0%; right: 0%;"></div>
                        </div>
                        <input
                            type="range"
                            id="price-min-input"
                            min="{{ $minPrice }}"
                            max="{{ $maxPrice }}"
                            step="25000"
                            value="{{ $minPrice }}"
                            class="range-slider-input"
                            aria-label="Harga minimum sektor"
                        >
                        <input
                            type="range"
                            id="price-max-input"
                            min="{{ $minPrice }}"
                            max="{{ $maxPrice }}"
                            step="25000"
                            value="{{ $maxPrice }}"
                            class="range-slider-input"
                            aria-label="Harga maksimum sektor"
                        >
                    </div>

                    <div class="mt-4 grid grid-cols-12 gap-3 items-end">
                        <div class="col-span-6 sm:col-span-5">
                            <span class="block text-[11px] font-medium text-ink-muted mb-1">Jumlah Tiket</span>
                            <div class="h-10 rounded-lg border border-slate-200 bg-white flex items-center justify-between px-2">
                                <button
                                    type="button"
                                    id="btn-qty-minus"
                                    class="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 text-ink font-bold text-sm inline-flex items-center justify-center transition"
                                    aria-label="Kurangi jumlah tiket"
                                >-</button>
                                <span id="ticket-qty-label" class="text-xs font-bold tracking-wide text-ink uppercase">1 Tiket</span>
                                <button
                                    type="button"
                                    id="btn-qty-plus"
                                    class="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 text-ink font-bold text-sm inline-flex items-center justify-center transition"
                                    aria-label="Tambah jumlah tiket"
                                >+</button>
                            </div>
                        </div>

                        <div class="col-span-3 sm:col-span-4">
                            <span class="block text-[11px] font-medium text-ink-muted mb-1">Sektor Dipilih</span>
                            <div class="h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                                <span id="footer-sector-code" class="text-sm font-bold font-mono text-navy-900">05</span>
                            </div>
                        </div>

                        <div class="col-span-3 sm:col-span-3">
                            <button
                                type="button"
                                id="btn-find-best-sector"
                                class="w-full h-10 rounded-lg bg-navy-900 hover:bg-navy-800 text-white inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition"
                                title="Pilih sektor terbaik sesuai rentang harga"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                </svg>
                                <span class="hidden sm:inline">Pilih Cepat</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {{-- Right Column (5 cols): Dark Navy Sector & Seat Detail Panel --}}
            <aside
                id="sector-detail-panel"
                class="lg:col-span-5 rounded-2xl bg-navy-900 text-white border border-navy-700/70 shadow-lg shadow-navy-950/15 p-5 sm:p-6 flex flex-col justify-between"
            >
                <div>
                    <div class="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
                        <div>
                            <span class="text-[11px] font-bold uppercase tracking-wider text-gold-400">Langkah 2 · Rincian Kursi</span>
                            <div class="mt-1 flex items-baseline gap-2.5">
                                <span id="panel-sector-code" class="text-3xl font-bold font-mono text-gold-400 leading-none">05</span>
                                <h2 id="panel-sector-name" class="text-base sm:text-lg font-bold uppercase tracking-wide text-white">
                                    Tribun Timur Tengah
                                </h2>
                            </div>
                            <p id="panel-sector-tier" class="text-xs text-slate-300 mt-1">Kategori 1 · Garis Tengah</p>
                        </div>
                    </div>

                    {{-- 2x2 Selector Grid (Access, Row, Seat, Price) --}}
                    <div class="mt-4 grid grid-cols-2 gap-3">
                        <div class="rounded-xl bg-navy-950/75 border border-white/10 px-3.5 py-2.5">
                            <span class="block text-[11px] text-slate-400">Pintu Masuk</span>
                            <span id="panel-access-gate" class="mt-0.5 block text-base font-bold font-mono text-white">328</span>
                        </div>

                        <div class="rounded-xl bg-navy-950/75 border border-white/10 px-3.5 py-2.5">
                            <span class="block text-[11px] text-slate-400">Subtotal Tiket</span>
                            <span id="panel-price-label" class="mt-0.5 block text-base font-bold text-gold-400 tabular-nums">Rp 450.000</span>
                        </div>

                        <div class="rounded-xl bg-navy-950/75 border border-white/10 px-3.5 py-2.5">
                            <label for="panel-row-select" class="block text-[11px] text-slate-400">Baris</label>
                            <select
                                id="panel-row-select"
                                class="mt-0.5 w-full bg-transparent text-base font-bold font-mono text-white focus:outline-none"
                            ></select>
                        </div>

                        <div class="rounded-xl bg-navy-950/75 border border-white/10 px-3.5 py-2.5">
                            <label for="panel-seat-select" class="block text-[11px] text-slate-400">Kursi</label>
                            <select
                                id="panel-seat-select"
                                class="mt-0.5 w-full bg-transparent text-base font-bold font-mono text-white focus:outline-none"
                            ></select>
                        </div>
                    </div>

                    {{-- Interactive Row Seat Map --}}
                    <div class="mt-5">
                        <div class="flex items-center justify-between text-xs text-slate-300 mb-2">
                            <span>Denah Kursi Baris <strong id="strip-row-label" class="text-white">14</strong></span>
                            <div class="flex items-center gap-3 text-[11px] text-slate-400">
                                <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-emerald-500/40 border border-emerald-400/50 inline-block"></span>Tersedia</span>
                                <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-gold-500 inline-block"></span>Dipilih</span>
                            </div>
                        </div>
                        <div id="panel-seat-strip" class="grid grid-cols-9 sm:grid-cols-10 gap-1.5"></div>
                    </div>
                </div>

                <div class="mt-6 pt-4 border-t border-white/10 flex flex-col gap-2.5">
                    <button
                        type="button"
                        id="btn-view-seat-3d"
                        class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-navy-950/70 hover:bg-navy-800 px-4 py-3 text-xs font-bold tracking-wider uppercase text-white transition"
                    >
                        <svg class="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                        </svg>
                        <span>Fokus Sudut Pandang Tiga Dimensi</span>
                    </button>

                    <button
                        type="button"
                        id="btn-pay-from-panel"
                        class="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 hover:bg-gold-400 px-4 py-3 text-xs font-bold tracking-wider uppercase text-navy-950 transition shadow-md shadow-gold-500/20"
                    >
                        <span>Bayar Sekarang</span>
                    </button>
                </div>
            </aside>
        </div>
    </section>

    {{-- SECTION 2: Always-Live Interactive 3D Stadium Point-of-View --}}
    <section id="seksi-3d" class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div class="rounded-2xl bg-white border border-slate-200/90 shadow-lg shadow-navy-950/10 overflow-hidden">
            {{-- 3D Section Header --}}
            <div class="bg-navy-950 text-white px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <span class="text-[11px] font-bold uppercase tracking-wider text-gold-400">Langkah 3 · Simulasi Duduk Langsung</span>
                    <div class="mt-0.5 flex flex-wrap items-baseline gap-2.5">
                        <span id="pov-sector-code" class="text-2xl font-bold font-mono text-gold-400">05</span>
                        <h2 id="pov-sector-name" class="text-base sm:text-xl font-bold tracking-wide uppercase">Tribun Timur Tengah</h2>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        id="btn-mode-seat"
                        class="rounded-lg px-3 py-1.5 text-xs font-bold tracking-wider uppercase bg-gold-500 text-navy-950 shadow transition"
                    >
                        Duduk di Kursi
                    </button>
                    <button
                        type="button"
                        id="btn-mode-overview"
                        class="rounded-lg px-3 py-1.5 text-xs font-bold tracking-wider uppercase bg-navy-900 text-slate-200 border border-white/20 hover:bg-navy-800 transition"
                    >
                        Tinjau Stadion
                    </button>
                    <span class="rounded-lg bg-white/10 border border-white/20 px-2.5 py-1.5 text-xs font-bold font-mono text-white">
                        3D
                    </span>
                </div>
            </div>

            {{-- Environment Simulation Bar: Time of Day & Weather --}}
            <div class="bg-navy-900 text-white px-5 sm:px-6 py-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Simulasi Jam:</span>
                    <button type="button" data-sim-time="day" class="sim-time-btn rounded-md px-2.5 py-1 font-semibold bg-gold-500 text-navy-950 transition">
                        Siang · 14:00
                    </button>
                    <button type="button" data-sim-time="sunset" class="sim-time-btn rounded-md px-2.5 py-1 font-semibold bg-white/10 text-slate-200 hover:bg-white/20 transition">
                        Sore · 17:30
                    </button>
                    <button type="button" data-sim-time="night" class="sim-time-btn rounded-md px-2.5 py-1 font-semibold bg-white/10 text-slate-200 hover:bg-white/20 transition">
                        Malam · 19:30
                    </button>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Simulasi Cuaca:</span>
                    <button type="button" data-sim-weather="clear" class="sim-weather-btn rounded-md px-2.5 py-1 font-semibold bg-gold-500 text-navy-950 transition">
                        Cerah
                    </button>
                    <button type="button" data-sim-weather="cloudy" class="sim-weather-btn rounded-md px-2.5 py-1 font-semibold bg-white/10 text-slate-200 hover:bg-white/20 transition">
                        Mendung
                    </button>
                    <button type="button" data-sim-weather="rain" class="sim-weather-btn rounded-md px-2.5 py-1 font-semibold bg-white/10 text-slate-200 hover:bg-white/20 transition">
                        Hujan
                    </button>
                </div>
            </div>

            {{-- Wide Interactive WebGL 3D Stadium Canvas --}}
            <div id="stadium-3d-container" class="relative bg-[#76b0e8] h-[380px] sm:h-[460px] lg:h-[540px] w-full overflow-hidden">
                <canvas id="stadium-3d-canvas" class="w-full h-full block cursor-grab active:cursor-grabbing"></canvas>

                {{-- Top-right Fullscreen button (Valencia CF style) --}}
                <button
                    type="button"
                    id="btn-3d-fullscreen"
                    class="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-navy-950/75 hover:bg-navy-900 border border-white/25 text-white inline-flex items-center justify-center transition shadow-md"
                    aria-label="Layar penuh tampilan stadion tiga dimensi"
                    title="Layar penuh"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                </button>

                <div class="absolute bottom-3.5 left-3.5 right-3.5 flex flex-wrap items-end justify-between gap-2 pointer-events-none">
                    <div class="pointer-events-auto flex items-end gap-2.5">
                        {{-- Mini-map inset (Valencia CF style) --}}
                        <div class="hidden sm:block rounded-lg bg-navy-950/85 border border-white/20 p-1.5 shadow-lg">
                            <svg id="pov-minimap-svg" viewBox="0 0 120 144" class="w-20 h-24 select-none" aria-hidden="true"></svg>
                        </div>

                        <div class="rounded-lg bg-navy-950/85 border border-white/15 px-3.5 py-2 text-xs text-slate-100">
                            <span class="text-gold-400 font-semibold">Sudut Pandang Kursi:</span>
                            <span id="pov-overlay-coords" class="font-mono ml-1">Sektor 05 · Baris 14 · Kursi 18</span>
                            <span class="hidden md:inline text-slate-400 ml-2">· Geser layar untuk menengok ke kiri atau kanan</span>
                        </div>
                    </div>

                    <div class="pointer-events-auto flex items-center gap-1.5">
                        <button
                            type="button"
                            id="btn-3d-zoom-in"
                            class="w-9 h-9 rounded-lg bg-navy-950/85 border border-white/20 text-white hover:bg-navy-800 text-sm font-bold"
                            aria-label="Perbesar tampilan"
                        >+</button>
                        <button
                            type="button"
                            id="btn-3d-zoom-out"
                            class="w-9 h-9 rounded-lg bg-navy-950/85 border border-white/20 text-white hover:bg-navy-800 text-sm font-bold"
                            aria-label="Perkecil tampilan"
                        >-</button>
                        <button
                            type="button"
                            id="btn-3d-reset"
                            class="h-9 px-3 rounded-lg bg-navy-950/85 border border-white/20 text-white hover:bg-navy-800 text-xs font-semibold"
                        >Reset Arah</button>
                    </div>
                </div>
            </div>

            {{-- Live Seat Switcher & Checkout Footer Bar --}}
            <div class="p-5 sm:p-6 bg-white border-t border-slate-100">
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                        <div class="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                            <label for="pov-sector-select" class="block text-[11px] font-medium text-ink-muted">Sektor</label>
                            <select
                                id="pov-sector-select"
                                class="mt-1 w-full bg-transparent text-sm font-bold font-mono text-ink focus:outline-none"
                            ></select>
                        </div>

                        <div class="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                            <span class="block text-[11px] font-medium text-ink-muted">Pintu Masuk</span>
                            <span id="pov-access-gate" class="mt-1 block text-sm font-bold font-mono text-ink">328</span>
                        </div>

                        <div class="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                            <label for="pov-row-select" class="block text-[11px] font-medium text-ink-muted">Baris</label>
                            <select
                                id="pov-row-select"
                                class="mt-1 w-full bg-transparent text-sm font-bold font-mono text-ink focus:outline-none"
                            ></select>
                        </div>

                        <div class="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                            <label for="pov-seat-select" class="block text-[11px] font-medium text-ink-muted">Kursi (<span id="pov-heading-seat">18</span>)</label>
                            <select
                                id="pov-seat-select"
                                class="mt-1 w-full bg-transparent text-sm font-bold font-mono text-ink focus:outline-none"
                            ></select>
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row sm:items-center gap-4 lg:pl-4 lg:border-l border-slate-200 shrink-0">
                        <div>
                            <span class="block text-xs text-ink-muted">Total (<span id="pov-ticket-count-label">1 Tiket</span>)</span>
                            <span id="pov-total-price" class="text-lg font-bold text-gold-600 tabular-nums">Rp 450.000</span>
                        </div>
                        <button
                            type="button"
                            id="btn-pay-from-3d"
                            class="h-11 px-6 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs tracking-wider uppercase transition shadow-md shadow-gold-500/20"
                        >
                            Pesan &amp; Bayar Kursi Ini
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>

{{-- Checkout & Confirmation Dialog --}}
<dialog id="checkout-dialog" class="stadium-dialog w-full max-w-md rounded-2xl bg-white p-0 shadow-2xl border border-slate-200 overflow-hidden">
    <div class="bg-navy-950 text-white px-5 py-4 flex items-center justify-between">
        <div>
            <h2 class="text-sm font-bold tracking-wide uppercase">Konfirmasi Pemesanan Tiket</h2>
            <p id="checkout-seat-summary" class="text-xs text-gold-400 mt-0.5 font-mono">Sektor 05 · Baris 14 · Kursi 18</p>
        </div>
        <button
            type="button"
            id="btn-close-checkout"
            class="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center"
            aria-label="Tutup konfirmasi pembayaran"
        >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    </div>

    <form id="checkout-form" class="p-5 space-y-4">
        <div id="checkout-error-box" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"></div>

        <div>
            <label for="buyer_name" class="block text-xs font-semibold text-ink mb-1">Nama Lengkap Pemesan</label>
            <input
                type="text"
                id="buyer_name"
                name="buyer_name"
                required
                placeholder="Contoh: Theo Pratama"
                class="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-ink focus:border-navy-800 focus:outline-none"
            >
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
                <label for="buyer_email" class="block text-xs font-semibold text-ink mb-1">Alamat Surel</label>
                <input
                    type="email"
                    id="buyer_email"
                    name="buyer_email"
                    required
                    placeholder="nama@contoh.id"
                    class="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-ink focus:border-navy-800 focus:outline-none"
                >
            </div>
            <div>
                <label for="buyer_phone" class="block text-xs font-semibold text-ink mb-1">Nomor Telepon</label>
                <input
                    type="tel"
                    id="buyer_phone"
                    name="buyer_phone"
                    required
                    placeholder="081234567890"
                    class="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-ink focus:border-navy-800 focus:outline-none"
                >
            </div>
        </div>

        <div>
            <label for="payment_method" class="block text-xs font-semibold text-ink mb-1">Metode Pembayaran Simulasi</label>
            <select
                id="payment_method"
                name="payment_method"
                class="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink focus:border-navy-800 focus:outline-none"
            >
                <option value="Transfer Bank Virtual">Transfer Bank Virtual</option>
                <option value="Dompet Digital">Dompet Digital</option>
                <option value="Kartu Debit atau Kredit">Kartu Debit atau Kredit</option>
            </select>
        </div>

        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5 text-xs">
            <div class="flex justify-between text-ink-muted">
                <span>Harga Kursi (<span id="checkout-qty-text">1 Tiket</span>)</span>
                <span id="checkout-subtotal" class="font-semibold text-ink tabular-nums">Rp 450.000</span>
            </div>
            <div class="flex justify-between text-ink-muted">
                <span>Biaya Layanan Sistem</span>
                <span class="font-semibold text-ink tabular-nums">Rp 10.000</span>
            </div>
            <div class="pt-1.5 border-t border-slate-200 flex justify-between text-sm font-bold text-navy-950">
                <span>Total Pembayaran</span>
                <span id="checkout-grand-total" class="text-gold-600 tabular-nums">Rp 460.000</span>
            </div>
        </div>

        <button
            type="submit"
            id="btn-submit-booking"
            class="w-full h-11 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs tracking-wider uppercase transition shadow-md shadow-gold-500/20"
        >
            Terbitkan Tiket Elektronik
        </button>
    </form>
</dialog>
@endsection
