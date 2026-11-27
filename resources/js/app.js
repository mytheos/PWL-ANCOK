import { Stadium3DViewer } from './stadium-3d.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SERVICE_FEE = 10000;

function formatRupiah(amount) {
    return `Rp ${Number(amount).toLocaleString('id-ID')}`;
}

function superellipsePoint(angleDeg, rx, rz, cx = 180, cy = 215, power = 3.4) {
    const rad = (angleDeg * Math.PI) / 180;
    const ux = Math.sin(rad);
    const uz = -Math.cos(rad);
    const denom = Math.pow(Math.pow(Math.abs(ux), power) + Math.pow(Math.abs(uz), power), 1 / power) || 1;
    const scale = 1 / denom;

    return [cx + ux * scale * rx, cy + uz * scale * rz];
}

function buildWedgePath(aStart, aEnd, rxIn, rzIn, rxOut, rzOut) {
    const steps = 10;
    const outerPts = [];
    const innerPts = [];

    for (let i = 0; i <= steps; i++) {
        const angle = aStart + ((aEnd - aStart) * i) / steps;
        outerPts.push(superellipsePoint(angle, rxOut, rzOut));
    }

    for (let i = steps; i >= 0; i--) {
        const angle = aStart + ((aEnd - aStart) * i) / steps;
        innerPts.push(superellipsePoint(angle, rxIn, rzIn));
    }

    const fmt = (pt) => `${pt[0].toFixed(2)} ${pt[1].toFixed(2)}`;
    const dOuter = outerPts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${fmt(pt)}`).join(' ');
    const dInner = innerPts.map((pt) => `L ${fmt(pt)}`).join(' ');

    return `${dOuter} ${dInner} Z`;
}

function buildRoundedContourPath(rx, rz) {
    const steps = 64;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 360;
        pts.push(superellipsePoint(angle, rx, rz));
    }

    return `${pts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt[0].toFixed(2)} ${pt[1].toFixed(2)}`).join(' ')} Z`;
}

function createSvgElement(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, String(value));
    }
    return el;
}

document.addEventListener('DOMContentLoaded', () => {
    const appEl = document.getElementById('stadium-app');
    if (!appEl) {
        return;
    }

    const initialState = JSON.parse(appEl.dataset.state || '{}');
    const bookingUrl = appEl.dataset.bookingUrl || '/pemesanan';

    const sectors = initialState.sectors || [];
    const activeMatch = initialState.activeMatch || {};
    const occupiedSeats = initialState.occupiedSeats || {};

    const prices = sectors.map((s) => Number(s.price));
    const catalogMinPrice = Math.min(...prices);
    const catalogMaxPrice = Math.max(...prices);

    const uiState = {
        selectedSectorCode: '05',
        rowNumber: 6,
        seatNumber: 3,
        ticketCount: 1,
        minPrice: catalogMinPrice,
        maxPrice: catalogMaxPrice,
        timeOfDay: 'day',
        weather: 'clear',
    };

    const svgEl = document.getElementById('stadium-topdown-svg');
    const minimapSvgEl = document.getElementById('pov-minimap-svg');
    const container3d = document.getElementById('stadium-3d-container');
    const canvas3d = document.getElementById('stadium-3d-canvas');
    const section3d = document.getElementById('seksi-3d');

    const panelSectorCode = document.getElementById('panel-sector-code');
    const panelSectorName = document.getElementById('panel-sector-name');
    const panelSectorTier = document.getElementById('panel-sector-tier');
    const panelAccessGate = document.getElementById('panel-access-gate');
    const panelRowSelect = document.getElementById('panel-row-select');
    const panelSeatSelect = document.getElementById('panel-seat-select');
    const panelPriceLabel = document.getElementById('panel-price-label');
    const stripRowLabel = document.getElementById('strip-row-label');
    const panelSeatStrip = document.getElementById('panel-seat-strip');

    const priceMinInput = document.getElementById('price-min-input');
    const priceMaxInput = document.getElementById('price-max-input');
    const filterMinLabel = document.getElementById('filter-min-label');
    const filterMaxLabel = document.getElementById('filter-max-label');
    const rangeFillBar = document.getElementById('range-fill-bar');
    const ticketQtyLabel = document.getElementById('ticket-qty-label');
    const footerSectorCode = document.getElementById('footer-sector-code');

    const povSectorCode = document.getElementById('pov-sector-code');
    const povSectorName = document.getElementById('pov-sector-name');
    const povOverlayCoords = document.getElementById('pov-overlay-coords');
    const povHeadingSeat = document.getElementById('pov-heading-seat');
    const povSectorSelect = document.getElementById('pov-sector-select');
    const povAccessGate = document.getElementById('pov-access-gate');
    const povRowSelect = document.getElementById('pov-row-select');
    const povSeatSelect = document.getElementById('pov-seat-select');
    const povTicketCountLabel = document.getElementById('pov-ticket-count-label');
    const povTotalPrice = document.getElementById('pov-total-price');

    const btnModeSeat = document.getElementById('btn-mode-seat');
    const btnModeOverview = document.getElementById('btn-mode-overview');

    const checkoutDialog = document.getElementById('checkout-dialog');
    const checkoutForm = document.getElementById('checkout-form');
    const checkoutErrorBox = document.getElementById('checkout-error-box');
    const checkoutSeatSummary = document.getElementById('checkout-seat-summary');
    const checkoutQtyText = document.getElementById('checkout-qty-text');
    const checkoutSubtotal = document.getElementById('checkout-subtotal');
    const checkoutGrandTotal = document.getElementById('checkout-grand-total');
    const btnSubmitBooking = document.getElementById('btn-submit-booking');

    const viewer3D = new Stadium3DViewer(canvas3d, {
        sectors,
        homeColor: activeMatch.home_color,
        awayColor: activeMatch.away_color,
        homeTeam: activeMatch.home_team,
        awayTeam: activeMatch.away_team,
        homeShort: activeMatch.home_short,
        awayShort: activeMatch.away_short,
        stadiumName: activeMatch.stadium_name,
    });

    function getSector(code) {
        return sectors.find((s) => s.code === code) || sectors[4] || sectors[0];
    }

    function isSeatOccupied(sectorCode, rowNumber, seatNumber) {
        return Boolean(occupiedSeats[`${sectorCode}-${rowNumber}-${seatNumber}`]);
    }

    function canBookBlock(sector, rowNumber, startSeat, count) {
        if (startSeat < 1 || startSeat + count - 1 > sector.seats_per_row) {
            return false;
        }
        for (let offset = 0; offset < count; offset++) {
            if (isSeatOccupied(sector.code, rowNumber, startSeat + offset)) {
                return false;
            }
        }
        return true;
    }

    function findFirstAvailableSeatInRow(sector, rowNumber, count) {
        for (let s = 1; s <= sector.seats_per_row - count + 1; s++) {
            if (canBookBlock(sector, rowNumber, s, count)) {
                return s;
            }
        }
        return null;
    }

    function ensureValidRowAndSeat(sector) {
        uiState.rowNumber = Math.min(Math.max(1, uiState.rowNumber), sector.rows_count);
        if (!canBookBlock(sector, uiState.rowNumber, uiState.seatNumber, uiState.ticketCount)) {
            const candidate = findFirstAvailableSeatInRow(sector, uiState.rowNumber, uiState.ticketCount);
            if (candidate !== null) {
                uiState.seatNumber = candidate;
                return;
            }
            for (let r = sector.rows_count; r >= 1; r--) {
                const alt = findFirstAvailableSeatInRow(sector, r, uiState.ticketCount);
                if (alt !== null) {
                    uiState.rowNumber = r;
                    uiState.seatNumber = alt;
                    return;
                }
            }
        }
    }

    function renderTopDownStadium() {
        svgEl.innerHTML = '';

        svgEl.appendChild(
            createSvgElement('path', {
                d: buildRoundedContourPath(162, 198),
                fill: '#f1f5fb',
                stroke: '#e2e8f0',
                'stroke-width': 1.5,
            }),
        );
        svgEl.appendChild(
            createSvgElement('path', {
                d: buildRoundedContourPath(148, 182),
                fill: '#f8fafd',
                stroke: '#e5ebf4',
                'stroke-width': 1,
            }),
        );

        for (const sector of sectors) {
            const inPriceRange =
                sector.price >= uiState.minPrice && sector.price <= uiState.maxPrice;
            const isSelected = uiState.selectedSectorCode === sector.code;

            const wedge = createSvgElement('path', {
                d: buildWedgePath(sector.angle_start + 1.2, sector.angle_end - 1.2, 82, 114, 138, 170),
                fill: isSelected ? '#eab348' : inPriceRange ? '#e9eff7' : '#f4f6fa',
                stroke: isSelected ? '#c98e1b' : '#ffffff',
                'stroke-width': isSelected ? 2 : 1.5,
                opacity: inPriceRange || isSelected ? '1' : '0.35',
                class: 'sector-wedge',
                'data-sector-code': sector.code,
                role: 'button',
                tabindex: '0',
                'aria-label': `Sektor ${sector.code} ${sector.name}, harga ${formatRupiah(sector.price)}`,
            });

            wedge.addEventListener('click', () => selectSector(sector.code));
            wedge.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectSector(sector.code);
                }
            });

            svgEl.appendChild(wedge);

            const midAngle = (sector.angle_start + sector.angle_end) / 2;
            const labelPt = superellipsePoint(midAngle, 111, 143);
            const label = createSvgElement('text', {
                x: labelPt[0].toFixed(1),
                y: (labelPt[1] + 4).toFixed(1),
                'text-anchor': 'middle',
                'font-size': isSelected ? '12' : '10.5',
                'font-weight': '700',
                'font-family': 'JetBrains Mono, monospace',
                fill: isSelected ? '#08122b' : inPriceRange ? '#1e3568' : '#94a3b8',
                class: 'pointer-events-none',
            });
            label.textContent = sector.code;
            svgEl.appendChild(label);
        }

        svgEl.appendChild(
            createSvgElement('path', {
                d: buildRoundedContourPath(76, 108),
                fill: '#14274e',
            }),
        );

        const pitchX = 118;
        const pitchY = 123;
        const pitchW = 124;
        const pitchH = 176;

        svgEl.appendChild(
            createSvgElement('rect', {
                x: pitchX,
                y: pitchY,
                width: pitchW,
                height: pitchH,
                rx: 3,
                fill: '#19a358',
            }),
        );

        const stripeCount = 10;
        const stripeH = pitchH / stripeCount;
        for (let i = 0; i < stripeCount; i++) {
            if (i % 2 === 0) {
                svgEl.appendChild(
                    createSvgElement('rect', {
                        x: pitchX,
                        y: pitchY + i * stripeH,
                        width: pitchW,
                        height: stripeH,
                        fill: '#1eb664',
                        opacity: '0.55',
                    }),
                );
            }
        }

        const lineAttrs = {
            fill: 'none',
            stroke: 'rgba(255,255,255,0.9)',
            'stroke-width': 1.3,
        };
        svgEl.appendChild(
            createSvgElement('rect', {
                ...lineAttrs,
                x: pitchX + 4,
                y: pitchY + 4,
                width: pitchW - 8,
                height: pitchH - 8,
            }),
        );
        svgEl.appendChild(
            createSvgElement('line', {
                ...lineAttrs,
                x1: pitchX + 4,
                y1: pitchY + pitchH / 2,
                x2: pitchX + pitchW - 4,
                y2: pitchY + pitchH / 2,
            }),
        );
        svgEl.appendChild(
            createSvgElement('circle', {
                ...lineAttrs,
                cx: 180,
                cy: pitchY + pitchH / 2,
                r: 17,
            }),
        );
        svgEl.appendChild(
            createSvgElement('circle', {
                cx: 180,
                cy: pitchY + pitchH / 2,
                r: 2.2,
                fill: '#ffffff',
            }),
        );
        svgEl.appendChild(
            createSvgElement('rect', {
                ...lineAttrs,
                x: 180 - 30,
                y: pitchY + 4,
                width: 60,
                height: 24,
            }),
        );
        svgEl.appendChild(
            createSvgElement('rect', {
                ...lineAttrs,
                x: 180 - 15,
                y: pitchY + 4,
                width: 30,
                height: 9,
            }),
        );
        svgEl.appendChild(
            createSvgElement('rect', {
                ...lineAttrs,
                x: 180 - 30,
                y: pitchY + pitchH - 28,
                width: 60,
                height: 24,
            }),
        );
        svgEl.appendChild(
            createSvgElement('rect', {
                ...lineAttrs,
                x: 180 - 15,
                y: pitchY + pitchH - 13,
                width: 30,
                height: 9,
            }),
        );

        const badgeText = createSvgElement('text', {
            x: '180',
            y: '313',
            'text-anchor': 'middle',
            'font-size': '9',
            'font-weight': '700',
            'letter-spacing': '1.5',
            fill: '#eab348',
        });
        badgeText.textContent = 'ARENA 3D';
        svgEl.appendChild(badgeText);

        renderMiniMapOverlay();
    }

    function renderMiniMapOverlay() {
        if (!minimapSvgEl) {
            return;
        }
        minimapSvgEl.innerHTML = '';

        for (const sector of sectors) {
            const isSelected = uiState.selectedSectorCode === sector.code;
            const pathStr = buildWedgePath(sector.angle_start + 1.5, sector.angle_end - 1.5, 82, 114, 138, 170);
            const g = createSvgElement('g', {
                transform: 'scale(0.3333)',
            });
            const wedge = createSvgElement('path', {
                d: pathStr,
                fill: isSelected ? '#eab348' : '#64748b',
                stroke: '#0f172a',
                'stroke-width': 3,
                class: 'cursor-pointer',
            });
            wedge.addEventListener('click', () => selectSector(sector.code));
            g.appendChild(wedge);
            minimapSvgEl.appendChild(g);
        }

        minimapSvgEl.appendChild(
            createSvgElement('rect', {
                x: '39',
                y: '41',
                width: '42',
                height: '59',
                rx: '2',
                fill: '#4c9e38',
                stroke: 'rgba(255,255,255,0.65)',
                'stroke-width': '1',
            }),
        );
    }

    function populateRowOptions(selectEl, sector) {
        selectEl.innerHTML = '';
        for (let r = 1; r <= sector.rows_count; r++) {
            const opt = document.createElement('option');
            opt.value = String(r);
            opt.textContent = String(r);
            opt.className = 'text-ink bg-white';
            if (r === uiState.rowNumber) {
                opt.selected = true;
            }
            selectEl.appendChild(opt);
        }
    }

    function populateSeatOptions(selectEl, sector) {
        selectEl.innerHTML = '';
        for (let s = 1; s <= sector.seats_per_row; s++) {
            const available = canBookBlock(sector, uiState.rowNumber, s, uiState.ticketCount);
            const opt = document.createElement('option');
            opt.value = String(s);
            opt.className = 'text-ink bg-white';
            if (uiState.ticketCount > 1 && available) {
                opt.textContent = `${s}–${s + uiState.ticketCount - 1}`;
            } else {
                opt.textContent = available ? String(s) : `${s} (Terjual)`;
            }
            if (!available) {
                opt.disabled = true;
            }
            if (s === uiState.seatNumber) {
                opt.selected = true;
            }
            selectEl.appendChild(opt);
        }
    }

    function populatePovSectorOptions() {
        povSectorSelect.innerHTML = '';
        for (const s of sectors) {
            const opt = document.createElement('option');
            opt.value = s.code;
            opt.textContent = `${s.code} · ${s.name}`;
            if (s.code === uiState.selectedSectorCode) {
                opt.selected = true;
            }
            povSectorSelect.appendChild(opt);
        }
    }

    function renderMiniSeatStrip(sector) {
        stripRowLabel.textContent = String(uiState.rowNumber);
        panelSeatStrip.innerHTML = '';

        for (let s = 1; s <= sector.seats_per_row; s++) {
            const occupied = isSeatOccupied(sector.code, uiState.rowNumber, s);
            const isSelected =
                s >= uiState.seatNumber && s < uiState.seatNumber + uiState.ticketCount;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = String(s);
            btn.disabled = occupied;

            if (isSelected) {
                btn.className =
                    'h-7 rounded text-[11px] font-bold font-mono bg-gold-500 text-navy-950 ring-1 ring-white';
            } else if (occupied) {
                btn.className =
                    'h-7 rounded text-[11px] font-mono bg-white/10 text-slate-500 cursor-not-allowed line-through';
            } else {
                btn.className =
                    'h-7 rounded text-[11px] font-semibold font-mono bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40 border border-emerald-400/30';
            }

            btn.addEventListener('click', () => {
                if (canBookBlock(sector, uiState.rowNumber, s, uiState.ticketCount)) {
                    uiState.seatNumber = s;
                    syncAllControls();
                }
            });

            panelSeatStrip.appendChild(btn);
        }
    }

    function syncAllControls(immediateCamera = false) {
        const sector = getSector(uiState.selectedSectorCode);
        ensureValidRowAndSeat(sector);

        panelSectorCode.textContent = sector.code;
        panelSectorName.textContent = sector.name;
        panelSectorTier.textContent = sector.tier_label;
        panelAccessGate.textContent = sector.access_gate;
        panelPriceLabel.textContent = formatRupiah(sector.price * uiState.ticketCount);

        populateRowOptions(panelRowSelect, sector);
        populateSeatOptions(panelSeatSelect, sector);
        renderMiniSeatStrip(sector);
        footerSectorCode.textContent = sector.code;

        povSectorCode.textContent = sector.code;
        povSectorName.textContent = sector.name;
        povAccessGate.textContent = sector.access_gate;
        const timeLabel = { day: 'Siang 14:00', sunset: 'Sore 17:30', night: 'Malam 19:30' }[uiState.timeOfDay];
        const weatherLabel = { clear: 'Cerah', cloudy: 'Mendung', rain: 'Hujan' }[uiState.weather];

        povHeadingSeat.textContent =
            uiState.ticketCount > 1
                ? `${uiState.seatNumber}–${uiState.seatNumber + uiState.ticketCount - 1}`
                : String(uiState.seatNumber);
        povOverlayCoords.textContent = `Sektor ${sector.code} · Baris ${uiState.rowNumber} · Kursi ${uiState.seatNumber} · ${timeLabel} · ${weatherLabel}`;
        povTicketCountLabel.textContent = `${uiState.ticketCount} Tiket`;
        povTotalPrice.textContent = formatRupiah(sector.price * uiState.ticketCount);

        populatePovSectorOptions();
        populateRowOptions(povRowSelect, sector);
        populateSeatOptions(povSeatSelect, sector);

        ticketQtyLabel.textContent = `${uiState.ticketCount} Tiket`;
        filterMinLabel.textContent = formatRupiah(uiState.minPrice);
        filterMaxLabel.textContent = formatRupiah(uiState.maxPrice);

        const span = Math.max(1, catalogMaxPrice - catalogMinPrice);
        const leftPct = ((uiState.minPrice - catalogMinPrice) / span) * 100;
        const rightPct = 100 - ((uiState.maxPrice - catalogMinPrice) / span) * 100;
        rangeFillBar.style.left = `${leftPct}%`;
        rangeFillBar.style.right = `${rightPct}%`;

        renderTopDownStadium();

        viewer3D.setSeat({
            sector,
            rowNumber: uiState.rowNumber,
            seatNumber: uiState.seatNumber,
            immediate: immediateCamera,
        });
    }

    function selectSector(code) {
        uiState.selectedSectorCode = code;
        const sector = getSector(code);
        uiState.rowNumber = Math.min(14, sector.rows_count);
        uiState.seatNumber = Math.ceil(sector.seats_per_row / 2);
        syncAllControls();
    }

    function updateCameraModeButtons(mode) {
        if (mode === 'seat') {
            btnModeSeat.className =
                'rounded-lg px-3 py-1.5 text-xs font-bold tracking-wider uppercase bg-gold-500 text-navy-950 shadow transition';
            btnModeOverview.className =
                'rounded-lg px-3 py-1.5 text-xs font-bold tracking-wider uppercase bg-navy-900 text-slate-200 border border-white/20 hover:bg-navy-800 transition';
        } else {
            btnModeOverview.className =
                'rounded-lg px-3 py-1.5 text-xs font-bold tracking-wider uppercase bg-gold-500 text-navy-950 shadow transition';
            btnModeSeat.className =
                'rounded-lg px-3 py-1.5 text-xs font-bold tracking-wider uppercase bg-navy-900 text-slate-200 border border-white/20 hover:bg-navy-800 transition';
        }
    }

    function focus3DSection() {
        viewer3D.setCameraMode('seat');
        updateCameraModeButtons('seat');
        viewer3D.resetLookDirection();
        section3d?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function openCheckoutModal() {
        const sector = getSector(uiState.selectedSectorCode);
        ensureValidRowAndSeat(sector);

        const seatDisplay =
            uiState.ticketCount > 1
                ? `${uiState.seatNumber}–${uiState.seatNumber + uiState.ticketCount - 1}`
                : String(uiState.seatNumber);

        const subtotal = sector.price * uiState.ticketCount;
        const grandTotal = subtotal + SERVICE_FEE;

        checkoutSeatSummary.textContent = `Sektor ${sector.code} · Pintu ${sector.access_gate} · Baris ${uiState.rowNumber} · Kursi ${seatDisplay}`;
        checkoutQtyText.textContent = `${uiState.ticketCount} Tiket`;
        checkoutSubtotal.textContent = formatRupiah(subtotal);
        checkoutGrandTotal.textContent = formatRupiah(grandTotal);
        checkoutErrorBox.classList.add('hidden');
        checkoutErrorBox.textContent = '';

        checkoutDialog.showModal();
    }

    document.getElementById('btn-view-seat-3d')?.addEventListener('click', focus3DSection);
    document.getElementById('btn-pay-from-panel')?.addEventListener('click', openCheckoutModal);
    document.getElementById('btn-pay-from-3d')?.addEventListener('click', openCheckoutModal);
    document.getElementById('btn-close-checkout')?.addEventListener('click', () => checkoutDialog.close());

    document.getElementById('btn-qty-minus')?.addEventListener('click', () => {
        if (uiState.ticketCount > 1) {
            uiState.ticketCount -= 1;
            syncAllControls();
        }
    });

    document.getElementById('btn-qty-plus')?.addEventListener('click', () => {
        if (uiState.ticketCount < 4) {
            uiState.ticketCount += 1;
            syncAllControls();
        }
    });

    priceMinInput?.addEventListener('input', () => {
        const val = Number(priceMinInput.value);
        uiState.minPrice = Math.min(val, uiState.maxPrice);
        priceMinInput.value = String(uiState.minPrice);
        syncAllControls();
    });

    priceMaxInput?.addEventListener('input', () => {
        const val = Number(priceMaxInput.value);
        uiState.maxPrice = Math.max(val, uiState.minPrice);
        priceMaxInput.value = String(uiState.maxPrice);
        syncAllControls();
    });

    document.getElementById('btn-find-best-sector')?.addEventListener('click', () => {
        const matching = sectors.filter(
            (s) => s.price >= uiState.minPrice && s.price <= uiState.maxPrice,
        );
        const pick = matching.find((s) => s.code === '05') || matching[0] || sectors[0];
        if (pick) {
            selectSector(pick.code);
        }
    });

    const handleRowChange = (newRow) => {
        uiState.rowNumber = Number(newRow);
        syncAllControls();
    };

    const handleSeatChange = (newSeat) => {
        uiState.seatNumber = Number(newSeat);
        syncAllControls();
    };

    panelRowSelect?.addEventListener('change', (e) => handleRowChange(e.target.value));
    panelSeatSelect?.addEventListener('change', (e) => handleSeatChange(e.target.value));
    povRowSelect?.addEventListener('change', (e) => handleRowChange(e.target.value));
    povSeatSelect?.addEventListener('change', (e) => handleSeatChange(e.target.value));

    povSectorSelect?.addEventListener('change', (e) => {
        uiState.selectedSectorCode = e.target.value;
        const sector = getSector(uiState.selectedSectorCode);
        ensureValidRowAndSeat(sector);
        syncAllControls();
    });

    btnModeSeat?.addEventListener('click', () => {
        viewer3D.setCameraMode('seat');
        updateCameraModeButtons('seat');
    });

    btnModeOverview?.addEventListener('click', () => {
        viewer3D.setCameraMode('overview');
        updateCameraModeButtons('overview');
    });

    document.getElementById('btn-3d-zoom-in')?.addEventListener('click', () => viewer3D.adjustZoom(-5));
    document.getElementById('btn-3d-zoom-out')?.addEventListener('click', () => viewer3D.adjustZoom(5));
    document.getElementById('btn-3d-reset')?.addEventListener('click', () => {
        viewer3D.setCameraMode('seat');
        updateCameraModeButtons('seat');
        viewer3D.resetLookDirection();
    });

    document.getElementById('btn-3d-fullscreen')?.addEventListener('click', () => {
        if (!container3d) {
            return;
        }
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
        } else {
            container3d.requestFullscreen?.();
        }
    });

    const simTimeBtns = document.querySelectorAll('.sim-time-btn');
    const simWeatherBtns = document.querySelectorAll('.sim-weather-btn');

    const updateSimButtons = () => {
        simTimeBtns.forEach((btn) => {
            const active = btn.dataset.simTime === uiState.timeOfDay;
            btn.className = active
                ? 'sim-time-btn rounded-md px-2.5 py-1 font-semibold bg-gold-500 text-navy-950 transition'
                : 'sim-time-btn rounded-md px-2.5 py-1 font-semibold bg-white/10 text-slate-200 hover:bg-white/20 transition';
        });
        simWeatherBtns.forEach((btn) => {
            const active = btn.dataset.simWeather === uiState.weather;
            btn.className = active
                ? 'sim-weather-btn rounded-md px-2.5 py-1 font-semibold bg-gold-500 text-navy-950 transition'
                : 'sim-weather-btn rounded-md px-2.5 py-1 font-semibold bg-white/10 text-slate-200 hover:bg-white/20 transition';
        });
    };

    simTimeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            uiState.timeOfDay = btn.dataset.simTime || 'day';
            viewer3D.setEnvironment({ timeOfDay: uiState.timeOfDay });
            updateSimButtons();
            syncAllControls(true);
        });
    });

    simWeatherBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            uiState.weather = btn.dataset.simWeather || 'clear';
            viewer3D.setEnvironment({ weather: uiState.weather });
            updateSimButtons();
            syncAllControls(true);
        });
    });

    checkoutForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        checkoutErrorBox.classList.add('hidden');

        const sector = getSector(uiState.selectedSectorCode);
        const formData = new FormData(checkoutForm);
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

        btnSubmitBooking.disabled = true;
        btnSubmitBooking.textContent = 'Memproses Tiket...';

        try {
            const response = await fetch(bookingUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    match_slug: activeMatch.slug,
                    sector_code: sector.code,
                    row_number: uiState.rowNumber,
                    seat_number: uiState.seatNumber,
                    ticket_count: uiState.ticketCount,
                    buyer_name: formData.get('buyer_name'),
                    buyer_email: formData.get('buyer_email'),
                    buyer_phone: formData.get('buyer_phone'),
                    payment_method: formData.get('payment_method'),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                const firstError =
                    (data.errors && Object.values(data.errors).flat()[0]) ||
                    data.message ||
                    'Pemesanan gagal diproses.';
                checkoutErrorBox.textContent = firstError;
                checkoutErrorBox.classList.remove('hidden');
                return;
            }

            if (data.ticket_url) {
                window.location.href = data.ticket_url;
            }
        } catch {
            checkoutErrorBox.textContent = 'Terjadi gangguan koneksi saat menerbitkan tiket.';
            checkoutErrorBox.classList.remove('hidden');
        } finally {
            btnSubmitBooking.disabled = false;
            btnSubmitBooking.textContent = 'Terbitkan Tiket Elektronik';
        }
    });

    syncAllControls(true);
});
