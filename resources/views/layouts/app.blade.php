<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'ArenaTiket — Pemesanan Kursi Stadion Tiga Dimensi')</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen flex flex-col bg-canvas text-ink antialiased selection:bg-gold-500/25 selection:text-navy-950">
    {{-- Full-Width Sticky Website Navigation Bar --}}
    <nav class="no-print sticky top-0 z-40 w-full bg-navy-950/95 backdrop-blur-sm border-b border-white/10 text-white">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <a href="{{ route('ticketing.index') }}" class="flex items-center gap-3 group">
                <span class="w-9 h-9 rounded-lg bg-gold-500 text-navy-950 inline-flex items-center justify-center font-bold shadow-sm group-hover:bg-gold-400 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 7.5l8.25-4.5 8.25 4.5v9l-8.25 4.5-8.25-4.5v-9z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 7.5L12 12m0 0l8.25-4.5M12 12v9" />
                    </svg>
                </span>
                <div>
                    <span class="block text-sm sm:text-base font-bold tracking-tight leading-none">ArenaTiket</span>
                    <span class="block text-[11px] text-slate-400 mt-0.5">Tiket Kursi Stadion Tiga Dimensi</span>
                </div>
            </a>

            <div class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
                <a href="{{ route('ticketing.index') }}#seksi-pertandingan" class="hover:text-white transition">Jadwal Laga</a>
                <a href="{{ route('ticketing.index') }}#seksi-peta" class="hover:text-white transition">Peta &amp; Pilih Kursi</a>
                <a href="{{ route('ticketing.index') }}#seksi-3d" class="hover:text-white transition">Sudut Pandang 3D</a>
                <a href="{{ route('bookings.index') }}" class="hover:text-white transition">Riwayat Tiket</a>
            </div>

            <div class="flex items-center gap-3">
                <a
                    href="{{ route('bookings.index') }}"
                    class="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition"
                >
                    <span>Tiket Saya</span>
                    <span id="recent-bookings-badge" class="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded bg-gold-500 text-navy-950 font-bold text-[11px]">
                        @yield('bookings_count', '0')
                    </span>
                </a>
            </div>
        </div>
    </nav>

    <div class="flex-1">
        @yield('content')
    </div>

    <footer class="no-print border-t border-slate-200 bg-white text-ink-muted">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
                <p class="font-semibold text-navy-950">ArenaTiket · Pemesanan Kursi Stadion Tiga Dimensi</p>
                <p class="mt-0.5">Pilih sektor pada peta stadion dan tinjau sudut pandang langsung dari kursi sebelum membeli tiket.</p>
            </div>
            <div class="flex items-center gap-4">
                <a href="{{ route('ticketing.index') }}" class="hover:text-navy-900 font-medium">Peta Stadion</a>
                <a href="{{ route('bookings.index') }}" class="hover:text-navy-900 font-medium">Riwayat Tiket</a>
            </div>
        </div>
    </footer>
</body>
</html>
