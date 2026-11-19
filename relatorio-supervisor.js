/* ============================================================================
   MÓDULO: RELATÓRIO GERENCIAL DE OBSERVAÇÕES — ENCARREGADO & SUPERVISOR
   Escala Imerys • Britagem ICP 1 (iOS Safari/PWA, Android Chrome e PC 60-144Hz)
   ============================================================================ */
(function () {
    if (window.__IMERYS_SUPERVISOR_LOADED__) return;
    window.__IMERYS_SUPERVISOR_LOADED__ = true;

    let exportMode = 'quadro'; // 'quadro' | 'supervisor'
    let supTeamFilter = 'all'; // 'all' | '0' | '1' | '2' | '3'
    let supSortMode = 'date';  // 'date' | 'team'

    const PALETTE = {
        M:  { bg: '#dbeafe', fg: '#1e40af' },
        T:  { bg: '#ffedd5', fg: '#9a3412' },
        N:  { bg: '#e0e7ff', fg: '#3730a3' },
        F:  { bg: '#dcfce7', fg: '#15803d' },
        AT: { bg: '#ffe4e6', fg: '#be123c' }
    };

    /* 1. ESTILOS EXCLUSIVOS DO RELATÓRIO DO SUPERVISOR (TELA + IMPRESSÃO MULTIPÁGINA A4) */
    function injectSupervisorStyles() {
        if (document.getElementById('supervisor-report-styles')) return;
        const style = document.createElement('style');
        style.id = 'supervisor-report-styles';
        style.textContent = `
            .a4-preview-frame.is-sup-preview {
                aspect-ratio: auto !important;
                max-height: 44vh;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch;
            }
            .a4-preview-spacer {
                position: relative;
                width: 100%;
                min-height: 100%;
            }
            .a4-preview-frame.is-sup-preview .a4-preview-scaler {
                height: auto !important;
            }

            /* Folha A4 Horizontal do Supervisor (expande conforme quantidade de observações) */
            .sup-sheet {
                width: 1122px;
                min-height: 793px;
                box-sizing: border-box;
                background: #ffffff;
                color: #0f172a;
                padding: 26px 28px 22px 28px;
                display: flex;
                flex-direction: column;
                font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .sup-kpi-grid {
                margin-top: 14px;
                display: grid;
                grid-template-columns: 0.95fr 0.95fr 1.85fr 1.05fr;
                gap: 11px;
            }
            .sup-kpi-card {
                border: 1.2px solid #cbd5e1;
                border-radius: 10px;
                background: #f8fafc;
                padding: 10px 13px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .sup-kpi-label {
                font-size: 9px;
                font-weight: 900;
                letter-spacing: 0.09em;
                text-transform: uppercase;
                color: #475569;
            }
            .sup-kpi-val {
                font-size: 24px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.1;
                margin-top: 4px;
                font-variant-numeric: tabular-nums;
            }
            .sup-kpi-sub {
                font-size: 10px;
                font-weight: 700;
                color: #64748b;
                margin-top: 3px;
            }
            .sup-team-chips {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 7px;
                margin-top: 7px;
            }
            .sup-team-chip {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 7px;
                padding: 5px 4px;
                text-align: center;
            }
            .sup-team-chip.is-dim { opacity: 0.45; }
            .sup-team-chip-lbl {
                display: block;
                font-size: 8.5px;
                font-weight: 800;
                color: #64748b;
                text-transform: uppercase;
            }
            .sup-team-chip-num {
                display: block;
                font-size: 14px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.15;
                font-variant-numeric: tabular-nums;
            }

            /* Tabela de Observações */
            .sup-table-wrap {
                margin-top: 14px;
                border: 1.5px solid #334155;
                border-radius: 10px;
                overflow: hidden;
                flex: 1;
            }
            .sup-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
            }
            .sup-table thead th {
                background: #0f172a;
                color: #ffffff;
                font-size: 10px;
                font-weight: 900;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                text-align: left;
                padding: 9px 11px;
                border-right: 1px solid #334155;
            }
            .sup-table thead th:last-child { border-right: none; }
            .sup-table tbody td {
                padding: 9px 11px;
                border-top: 1px solid #e2e8f0;
                border-right: 1px solid #e2e8f0;
                vertical-align: top;
                text-align: left;
                font-size: 11.5px;
            }
            .sup-table tbody td:last-child { border-right: none; }
            .sup-table tbody tr:nth-child(even) { background: #f8fafc; }
            .sup-table tbody tr:nth-child(odd) { background: #ffffff; }

            .sup-col-date { width: 96px; }
            .sup-col-team { width: 196px; }
            .sup-col-shift { width: 152px; }

            .sup-date-main {
                display: block;
                font-size: 14px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.1;
                font-variant-numeric: tabular-nums;
            }
            .sup-date-dow {
                display: block;
                font-size: 9.5px;
                font-weight: 800;
                text-transform: uppercase;
                color: #64748b;
                margin-top: 2px;
            }
            .sup-is-red .sup-date-main { color: #dc2626; }
            .sup-is-red .sup-date-dow { color: #ef4444; }

            .sup-team-cell { display: flex; align-items: flex-start; gap: 8px; }
            .sup-team-badge {
                width: 22px;
                height: 22px;
                border-radius: 6px;
                background: #0f172a;
                color: #ffffff;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 900;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .sup-team-title {
                display: block;
                font-size: 12px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.15;
            }
            .sup-team-names {
                display: block;
                font-size: 10px;
                font-weight: 700;
                color: #475569;
                margin-top: 2px;
                word-break: break-word;
            }

            .sup-shift-cell { display: flex; align-items: flex-start; gap: 8px; }
            .sup-shift-chip {
                min-width: 28px;
                height: 22px;
                padding: 0 5px;
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 900;
                flex-shrink: 0;
            }
            .sup-shift-name {
                display: block;
                font-size: 11px;
                font-weight: 800;
                color: #0f172a;
                line-height: 1.15;
            }
            .sup-shift-hours {
                display: block;
                font-size: 9.5px;
                font-weight: 700;
                color: #64748b;
                margin-top: 2px;
                font-variant-numeric: tabular-nums;
            }

            .sup-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-bottom: 5px;
            }
            .sup-tag {
                display: inline-block;
                font-size: 8.5px;
                font-weight: 900;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                padding: 2px 6px;
                border-radius: 5px;
                border: 1px solid transparent;
                line-height: 1.25;
            }
            .sup-tag-holi { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
            .sup-tag-ov   { background: #fef3c7; color: #92400e; border-color: #fde68a; }
            .sup-tag-at   { background: #ffe4e6; color: #be123c; border-color: #fecdd3; }

            .sup-obs-text {
                font-size: 12px;
                font-weight: 600;
                color: #0f172a;
                line-height: 1.42;
                white-space: pre-wrap;
                word-break: break-word;
            }
            .sup-empty-box {
                padding: 48px 24px;
                text-align: center;
                background: #f8fafc;
                color: #64748b;
                font-size: 13px;
                font-weight: 700;
            }

            /* Vistos de Fechamento */
            .sup-sign-grid {
                margin-top: 22px;
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 28px;
                break-inside: avoid;
                page-break-inside: avoid;
            }
            .sup-sign-box { text-align: center; padding-top: 28px; }
            .sup-sign-line { border-top: 1.5px solid #475569; padding-top: 5px; font-size: 10px; font-weight: 800; color: #334155; }

            @media print {
                #print-sheet.is-supervisor-print .sup-sheet {
                    width: 100% !important;
                    min-height: 0 !important;
                    height: auto !important;
                    max-height: none !important;
                    padding: 3mm 4mm 2mm 4mm !important;
                    margin: 0 !important;
                }
                #print-sheet.is-supervisor-print .sup-table-wrap {
                    overflow: visible !important;
                    border-radius: 6px !important;
                }
                #print-sheet.is-supervisor-print .sup-table thead {
                    display: table-header-group !important;
                }
                #print-sheet.is-supervisor-print .sup-table tbody tr {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                }
                #print-sheet.is-supervisor-print .sup-sign-grid,
                #print-sheet.is-supervisor-print .a4-footer {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /* 2. ATUALIZAÇÃO DO MODAL DE EXPORTAÇÃO COM ABAS (OPERADORES + SUPERVISOR) */
    function upgradeExportModalDOM() {
        const panel = document.getElementById('export-modal-content');
        if (!panel || panel.dataset.supUpgraded === '1') return;
        panel.dataset.supUpgraded = '1';

        panel.innerHTML = `
            <div class="md:hidden w-12 h-1.5 bg-slate-300 dark:bg-surfaceBorder rounded-full mx-auto mb-4"></div>
            <div class="flex justify-between items-start gap-3 mb-3.5">
                <div class="min-w-0">
                    <span id="export-mode-pill" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-200/70 dark:border-blue-900/50 mb-1.5">Quadro de Avisos • A4 Horizontal</span>
                    <h3 id="export-modal-title" class="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-tight">Exportar &amp; Imprimir Escala</h3>
                    <p id="export-modal-subtitle" class="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Todos os 4 turnos, horários, totais e feriados — sem observações individuais.</p>
                </div>
                <button type="button" onclick="closeExportModal()" class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-surfaceBorder dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-slate-300 cursor-pointer btn-smooth shrink-0" aria-label="Fechar exportação">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <!-- Abas: Quadro Operadores vs Relatório Supervisor -->
            <div class="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-oled border border-slate-200 dark:border-surfaceBorder mb-4">
                <button type="button" id="export-tab-quadro" onclick="switchExportMode('quadro')" class="py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 btn-smooth cursor-pointer">
                    <span>Quadro dos Turnos</span>
                </button>
                <button type="button" id="export-tab-supervisor" onclick="switchExportMode('supervisor')" class="py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 btn-smooth cursor-pointer">
                    <span>Relatório Supervisor</span>
                    <span id="sup-tab-badge" class="px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums">0</span>
                </button>
            </div>

            <!-- Filtros exclusivos do Relatório do Supervisor -->
            <div id="export-supervisor-options" class="hidden rounded-2xl bg-slate-50 dark:bg-oled border border-slate-200 dark:border-surfaceBorder p-3.5 mb-4 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Filtrar Turno</span>
                    <div class="grid grid-cols-5 gap-1.5" id="sup-team-filters">
                        <button type="button" data-sup-team="all" onclick="setSupervisorTeamFilter('all')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">Todos</button>
                        <button type="button" data-sup-team="0" onclick="setSupervisorTeamFilter('0')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">A</button>
                        <button type="button" data-sup-team="1" onclick="setSupervisorTeamFilter('1')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">B</button>
                        <button type="button" data-sup-team="2" onclick="setSupervisorTeamFilter('2')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">C</button>
                        <button type="button" data-sup-team="3" onclick="setSupervisorTeamFilter('3')" class="sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">D</button>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2.5 border-t border-slate-200/80 dark:border-surfaceBorder">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Ordenação</span>
                        <span id="sup-count-pill" class="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 tabular-nums"></span>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                        <button type="button" data-sup-sort="date" onclick="setSupervisorSortMode('date')" class="sup-sort-btn py-1.5 px-3 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">Por Data (1 → 31)</button>
                        <button type="button" data-sup-sort="team" onclick="setSupervisorSortMode('team')" class="sup-sort-btn py-1.5 px-3 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">Por Turno (A → D)</button>
                    </div>
                </div>
            </div>

            <!-- Prévia Real A4 Horizontal -->
            <div class="mb-4">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span id="export-preview-caption" class="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">Prévia da Folha A4 (Paisagem • 1 Página)</span>
                    <span id="export-month-badge" class="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase shrink-0"></span>
                </div>
                <div id="a4-preview-frame" class="a4-preview-frame">
                    <div id="a4-preview-spacer" class="a4-preview-spacer">
                        <div id="a4-preview-scaler" class="a4-preview-scaler"></div>
                    </div>
                </div>
            </div>

            <!-- Opção exclusiva do Quadro dos Turnos -->
            <label id="export-quadro-options" class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-oled border border-slate-200 dark:border-surfaceBorder mb-4 cursor-pointer">
                <div class="min-w-0">
                    <span class="block text-xs font-extrabold text-slate-800 dark:text-slate-100">Incluir trocas/extras e atestados no quadro</span>
                    <span class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Desligado imprime a escala oficial limpa de todos os turnos. Observações nunca aparecem.</span>
                </div>
                <input type="checkbox" id="a4-include-changes" onchange="onA4OptionsChange()" class="w-5 h-5 rounded accent-blue-600 shrink-0 cursor-pointer">
            </label>

            <!-- Botões Principais -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                <button type="button" onclick="printA4Schedule()" class="py-3.5 px-4 rounded-2xl font-extrabold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-95 btn-smooth cursor-pointer">
                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                    <span id="export-print-btn-label">Imprimir / Salvar PDF (A4)</span>
                </button>
                <button type="button" onclick="triggerExportPNG()" class="py-3.5 px-4 rounded-2xl font-extrabold text-sm text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-surfaceBorder dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center gap-2 active:scale-95 btn-smooth cursor-pointer">
                    <svg class="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    <span id="export-png-btn-label">Baixar Imagem A4 HD (.PNG)</span>
                </button>
            </div>

            <!-- Botão Copiar Texto (Exclusivo Relatório Supervisor) -->
            <button type="button" id="sup-copy-btn" onclick="copySupervisorSummary()" class="hidden w-full py-3 px-4 mb-4 rounded-2xl font-extrabold text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center gap-2 active:scale-95 btn-smooth cursor-pointer">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                <span>Copiar Relatório em Texto (WhatsApp / E-mail)</span>
            </button>

            <!-- Opção Secundária: Agenda Pessoal (.ICS) -->
            <div class="pt-3.5 border-t border-slate-200 dark:border-surfaceBorder flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div class="min-w-0">
                    <span class="block text-xs font-extrabold text-slate-700 dark:text-slate-200">Agenda Pessoal do Celular (.ICS)</span>
                    <span id="export-ics-subtitle" class="block text-[11px] font-medium text-slate-500 dark:text-slate-400">Importe apenas o turno selecionado no Google ou Apple Calendar.</span>
                </div>
                <button type="button" onclick="exportICS()" class="py-2.5 px-4 rounded-xl font-bold text-xs text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center gap-1.5 active:scale-95 btn-smooth shrink-0 cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span>Baixar .ICS</span>
                </button>
            </div>
        `;
    }

    /* 3. MOTOR DE DADOS DO RELATÓRIO DE OBSERVAÇÕES */
    function buildSupervisorDataset(teamFilter, sortMode) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthLabel = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        const mmStr = String(month + 1).padStart(2, '0');
        const holidaysMap = getHolidays(year, month);
        const targetTeams = teamFilter === 'all' ? [0, 1, 2, 3] : [parseInt(teamFilter, 10)];

        /* Pré-indexação O(1) de atestados de todos os turnos */
        const atByTeam = [{}, {}, {}, {}];
        for (let idx = 0; idx < 4; idx++) {
            atestadosDb.filter(r => r.turma === idx).forEach(rec => {
                const dates = getAtestadoDates(rec);
                dates.forEach((d, pos) => {
                    atByTeam[idx][d] = { dayIndex: pos + 1, totalDays: dates.length };
                });
            });
        }

        const entries = [];
        const perTeamAll = [0, 0, 0, 0];
        const uniqueDaysSet = new Set();
        let specialCount = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${mmStr}-${String(day).padStart(2, '0')}`;
            const dow = new Date(year, month, day, 12, 0, 0).getDay();
            const isSunday = dow === 0;
            const holiday = holidaysMap[day] || '';

            for (let idx = 0; idx < 4; idx++) {
                const text = getNote(dateKey, idx).trim();
                if (!text) continue;
                perTeamAll[idx]++;
                if (!targetTeams.includes(idx)) continue;

                const baseShift = getShift(year, month, day, idx);
                const ovShift = overridesDb[`${dateKey}_${idx}`] || '';
                const atInfo = atByTeam[idx][dateKey] || null;
                const code = atInfo ? 'AT' : (ovShift || baseShift);
                const shiftCfg = SHIFTS_CONFIG[code] || SHIFTS_CONFIG.M;
                const shiftLabel = atInfo ? `Atestado (${atInfo.dayIndex}/${atInfo.totalDays})` : shiftCfg.name;
                const shiftHours = atInfo ? 'Afastamento' : (shiftCfg.hours || 'Descanso');

                uniqueDaysSet.add(day);
                if (atInfo || ovShift) specialCount++;

                entries.push({
                    day,
                    dateKey,
                    dateStr: `${String(day).padStart(2, '0')}/${mmStr}`,
                    dowPretty: DOW_PRETTY[dow],
                    dowLabel: DOW_NAMES[dow],
                    isSunday,
                    holiday,
                    turmaIdx: idx,
                    letter: TEAM_LETTERS[idx],
                    teamName: teamNames[idx],
                    code,
                    shiftLabel,
                    shiftHours,
                    isOv: Boolean(!atInfo && ovShift),
                    isAt: Boolean(atInfo),
                    text
                });
            }
        }

        if (sortMode === 'team') {
            entries.sort((a, b) => (a.turmaIdx - b.turmaIdx) || (a.day - b.day));
        } else {
            entries.sort((a, b) => (a.day - b.day) || (a.turmaIdx - b.turmaIdx));
        }

        const totalAllMonth = perTeamAll.reduce((acc, n) => acc + n, 0);
        const scopeLabel = teamFilter === 'all'
            ? 'Todos os Turnos (A, B, C e D)'
            : `Turno ${TEAM_LETTERS[targetTeams[0]]} (${teamNames[targetTeams[0]]})`;
        const sortLabel = sortMode === 'team' ? 'Agrupado por Turno (A → D)' : 'Ordem Cronológica (Dia 1 → 31)';
        const issued = new Date();
        const issuedStr = `${String(issued.getDate()).padStart(2, '0')}/${String(issued.getMonth() + 1).padStart(2, '0')}/${issued.getFullYear()} às ${String(issued.getHours()).padStart(2, '0')}:${String(issued.getMinutes()).padStart(2, '0')}`;

        return {
            year, month, mmStr, daysInMonth, monthLabel, teamFilter, sortMode,
            scopeLabel, sortLabel, entries,
            totalNotes: entries.length,
            totalAllMonth,
            uniqueDays: uniqueDaysSet.size,
            perTeam: perTeamAll,
            specialCount,
            issuedStr
        };
    }

    /* 4. HTML DO RELATÓRIO DO SUPERVISOR (PRÉVIA EM TELA + IMPRESSÃO A4 MULTIPÁGINA) */
    function buildSupervisorSheetHTML(data) {
        const teamChipsHTML = TEAM_LETTERS.map((ltr, idx) => {
            const dimCls = (data.teamFilter !== 'all' && String(idx) !== String(data.teamFilter)) ? ' is-dim' : '';
            return `<div class="sup-team-chip${dimCls}"><span class="sup-team-chip-lbl">Turno ${ltr}</span><span class="sup-team-chip-num">${data.perTeam[idx]}</span></div>`;
        }).join('');

        let tableBodyHTML = '';
        if (!data.entries.length) {
            tableBodyHTML = `<tr><td colspan="4" class="sup-empty-box">Nenhuma observação registrada para o filtro selecionado neste mês.</td></tr>`;
        } else {
            tableBodyHTML = data.entries.map(item => {
                const redCls = (item.isSunday || item.holiday) ? ' sup-is-red' : '';
                const tags = [];
                if (item.holiday) tags.push(`<span class="sup-tag sup-tag-holi">Feriado: ${escapeHTML(item.holiday)}</span>`);
                if (item.isOv) tags.push(`<span class="sup-tag sup-tag-ov">Troca / Hora Extra</span>`);
                if (item.isAt) tags.push(`<span class="sup-tag sup-tag-at">${escapeHTML(item.shiftLabel)}</span>`);
                const tagsHTML = tags.length ? `<div class="sup-tags">${tags.join('')}</div>` : '';

                return `<tr>
                    <td class="${redCls}">
                        <span class="sup-date-main">${item.dateStr}</span>
                        <span class="sup-date-dow">${item.dowPretty}</span>
                    </td>
                    <td>
                        <div class="sup-team-cell">
                            <span class="sup-team-badge">${item.letter}</span>
                            <div>
                                <span class="sup-team-title">Turno ${item.letter}</span>
                                <span class="sup-team-names">${escapeHTML(item.teamName)}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="sup-shift-cell">
                            <span class="sup-shift-chip a4-cell-${item.code}">${item.code}</span>
                            <div>
                                <span class="sup-shift-name">${escapeHTML(item.shiftLabel)}</span>
                                <span class="sup-shift-hours">${escapeHTML(item.shiftHours)}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${tagsHTML}
                        <div class="sup-obs-text">${escapeHTML(item.text)}</div>
                    </td>
                </tr>`;
            }).join('');
        }

        return `<div class="sup-sheet">
            <div class="a4-header">
                <div class="a4-brand">
                    <img class="a4-logo" src="${IMERYS_SVG_URI}" alt="Imerys">
                    <div>
                        <h2 class="a4-title">RELATÓRIO DE OBSERVAÇÕES — FECHAMENTO</h2>
                        <div class="a4-subtitle">IMERYS • BRITAGEM ICP 1 • ENCARREGADO &amp; SUPERVISOR DE BRITAGEM</div>
                    </div>
                </div>
                <div class="a4-period-box">
                    <span class="a4-month-pill">${escapeHTML(data.monthLabel)}</span>
                    <span class="a4-cycle-note">${escapeHTML(data.scopeLabel)} • ${escapeHTML(data.sortLabel)}</span>
                </div>
            </div>

            <div class="sup-kpi-grid">
                <div class="sup-kpi-card">
                    <span class="sup-kpi-label">Observações no Mês</span>
                    <div class="sup-kpi-val">${data.totalNotes}</div>
                    <span class="sup-kpi-sub">${data.teamFilter === 'all' ? 'Todos os turnos' : `de ${data.totalAllMonth} no mês`}</span>
                </div>
                <div class="sup-kpi-card">
                    <span class="sup-kpi-label">Dias com Registro</span>
                    <div class="sup-kpi-val">${data.uniqueDays}</div>
                    <span class="sup-kpi-sub">de ${data.daysInMonth} dias do mês</span>
                </div>
                <div class="sup-kpi-card">
                    <span class="sup-kpi-label">Observações por Turno</span>
                    <div class="sup-team-chips">${teamChipsHTML}</div>
                </div>
                <div class="sup-kpi-card">
                    <span class="sup-kpi-label">Extras / Atestados</span>
                    <div class="sup-kpi-val">${data.specialCount}</div>
                    <span class="sup-kpi-sub">Ocorrências c/ obs.</span>
                </div>
            </div>

            <div class="sup-table-wrap">
                <table class="sup-table">
                    <thead>
                        <tr>
                            <th class="sup-col-date">Data</th>
                            <th class="sup-col-team">Turno / Equipe</th>
                            <th class="sup-col-shift">Escala do Dia</th>
                            <th>Observação Registrada</th>
                        </tr>
                    </thead>
                    <tbody>${tableBodyHTML}</tbody>
                </table>
            </div>

            <div class="sup-sign-grid">
                <div class="sup-sign-box"><div class="sup-sign-line">Encarregado de Britagem</div></div>
                <div class="sup-sign-box"><div class="sup-sign-line">Supervisor de Britagem</div></div>
                <div class="sup-sign-box"><div class="sup-sign-line">Data de Fechamento</div></div>
            </div>

            <div class="a4-footer">
                <span>Imerys • Britagem ICP 1 • Relatório Gerencial de Observações (Fechamento Mensal)</span>
                <span>Emitido em ${data.issuedStr} • Formato A4 Horizontal</span>
            </div>
        </div>`;
    }

    /* 5. SINCRONIZAÇÃO DE INTERFACE, ABAS, FILTROS E PRÉVIA */
    function syncExportModeUI(supData) {
        const isSup = exportMode === 'supervisor';
        const pill = document.getElementById('export-mode-pill');
        const title = document.getElementById('export-modal-title');
        const sub = document.getElementById('export-modal-subtitle');
        const caption = document.getElementById('export-preview-caption');
        const tabQuadro = document.getElementById('export-tab-quadro');
        const tabSup = document.getElementById('export-tab-supervisor');
        const tabBadge = document.getElementById('sup-tab-badge');
        const quadroOpts = document.getElementById('export-quadro-options');
        const supOpts = document.getElementById('export-supervisor-options');
        const printLbl = document.getElementById('export-print-btn-label');
        const pngLbl = document.getElementById('export-png-btn-label');
        const copyBtn = document.getElementById('sup-copy-btn');
        const countPill = document.getElementById('sup-count-pill');

        const activeTabCls = 'py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 btn-smooth cursor-pointer bg-white dark:bg-surface text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-surfaceBorder';
        const idleTabCls = 'py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 btn-smooth cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent';

        if (tabQuadro) tabQuadro.className = isSup ? idleTabCls : activeTabCls;
        if (tabSup) tabSup.className = isSup ? activeTabCls : idleTabCls;
        if (tabBadge && supData) {
            tabBadge.innerText = String(supData.totalAllMonth);
            tabBadge.className = isSup
                ? 'px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums bg-blue-600 text-white'
                : 'px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums bg-slate-200 dark:bg-surfaceBorder text-slate-700 dark:text-slate-200';
        }

        if (pill) {
            pill.innerText = isSup ? 'Fechamento Mensal • Encarregado / Supervisor' : 'Quadro de Avisos • A4 Horizontal';
            pill.className = isSup
                ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-200/70 dark:border-indigo-900/50 mb-1.5'
                : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-200/70 dark:border-blue-900/50 mb-1.5';
        }
        if (title) title.innerText = isSup ? 'Relatório de Observações' : 'Exportar & Imprimir Escala';
        if (sub) sub.innerText = isSup
            ? 'Todas as ocorrências e anotações do mês organizadas para fechamento da britagem.'
            : 'Todos os 4 turnos, horários, totais e feriados — sem observações individuais.';
        if (caption) caption.innerText = isSup
            ? 'Prévia do Relatório (A4 Paisagem • Role para conferir)'
            : 'Prévia da Folha A4 (Paisagem • 1 Página)';

        quadroOpts?.classList.toggle('hidden', isSup);
        supOpts?.classList.toggle('hidden', !isSup);
        copyBtn?.classList.toggle('hidden', !isSup);
        if (printLbl) printLbl.innerText = isSup ? 'Imprimir / PDF Relatório' : 'Imprimir / Salvar PDF (A4)';
        if (pngLbl) pngLbl.innerText = isSup ? 'Baixar Relatório HD (.PNG)' : 'Baixar Imagem A4 HD (.PNG)';

        if (countPill && supData) {
            countPill.innerText = `${supData.totalNotes} ${supData.totalNotes === 1 ? 'registro' : 'registros'}`;
        }

        document.querySelectorAll('.sup-filter-btn').forEach(btn => {
            const act = btn.getAttribute('data-sup-team') === String(supTeamFilter);
            btn.className = `sup-filter-btn py-1.5 px-2 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer ${act
                ? 'bg-slate-900 border-slate-900 text-white dark:bg-blue-600 dark:border-blue-600'
                : 'bg-white hover:bg-slate-100 dark:bg-surface dark:hover:bg-zinc-900 border-slate-200 dark:border-surfaceBorder text-slate-600 dark:text-slate-300'}`;
        });
        document.querySelectorAll('.sup-sort-btn').forEach(btn => {
            const act = btn.getAttribute('data-sup-sort') === supSortMode;
            btn.className = `sup-sort-btn py-1.5 px-3 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer ${act
                ? 'bg-slate-900 border-slate-900 text-white dark:bg-blue-600 dark:border-blue-600'
                : 'bg-white hover:bg-slate-100 dark:bg-surface dark:hover:bg-zinc-900 border-slate-200 dark:border-surfaceBorder text-slate-600 dark:text-slate-300'}`;
        });
    }

    function applyScaledPreview() {
        const frame = document.getElementById('a4-preview-frame');
        const spacer = document.getElementById('a4-preview-spacer');
        const scaler = document.getElementById('a4-preview-scaler');
        if (!frame || !scaler) return;
        const isSup = exportMode === 'supervisor';
        frame.classList.toggle('is-sup-preview', isSup);
        const w = frame.clientWidth;
        if (w <= 0) return;
        const scale = w / 1122;
        scaler.style.transform = `scale(${scale})`;
        if (spacer) {
            if (isSup) {
                const naturalH = Math.max(793, scaler.scrollHeight || 793);
                spacer.style.height = `${Math.ceil(naturalH * scale)}px`;
            } else {
                spacer.style.height = `${Math.ceil(793 * scale)}px`;
            }
        }
    }

    function refreshAllExportOutputs() {
        upgradeExportModalDOM();
        const supData = buildSupervisorDataset(supTeamFilter, supSortMode);
        syncExportModeUI(supData);

        const printEl = document.getElementById('print-sheet');
        const scaler = document.getElementById('a4-preview-scaler');
        const badge = document.getElementById('export-month-badge');
        const icsSub = document.getElementById('export-ics-subtitle');

        if (icsSub) {
            icsSub.innerText = `Exporta apenas o Turno ${TEAM_LETTERS[currentTurma]} (${teamNames[currentTurma]}) para Google ou Apple Calendar.`;
        }

        if (exportMode === 'supervisor') {
            const html = buildSupervisorSheetHTML(supData);
            if (printEl) {
                printEl.classList.add('is-supervisor-print');
                printEl.innerHTML = html;
            }
            if (scaler) scaler.innerHTML = html;
            if (badge) badge.innerText = supData.monthLabel;
            requestAnimationFrame(applyScaledPreview);
            return supData;
        } else {
            const quadroData = buildA4Dataset(a4IncludeChanges);
            const html = buildA4SheetHTML(quadroData);
            if (printEl) {
                printEl.classList.remove('is-supervisor-print');
                printEl.innerHTML = html;
            }
            if (scaler) scaler.innerHTML = html;
            if (badge) badge.innerText = quadroData.monthLabel;
            requestAnimationFrame(applyScaledPreview);
            return quadroData;
        }
    }

    /* 6. GERADOR DE IMAGEM HD (.PNG) COM PROTEÇÃO DE MEMÓRIA iOS SAFARI */
    function wrapCanvasLines(ctx, text, maxW) {
        const result = [];
        const paragraphs = String(text || '').split(/\r?\n/);
        paragraphs.forEach(para => {
            if (!para.trim()) { result.push(''); return; }
            const words = para.split(/\s+/);
            let line = '';
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const test = line ? `${line} ${word}` : word;
                if (ctx.measureText(test).width <= maxW) {
                    line = test;
                } else {
                    if (line) { result.push(line); line = ''; }
                    if (ctx.measureText(word).width <= maxW) {
                        line = word;
                    } else {
                        /* Quebra palavra muito longa sem estourar a margem */
                        let chunk = '';
                        for (let ch of word) {
                            if (ctx.measureText(chunk + ch).width > maxW && chunk) {
                                result.push(chunk);
                                chunk = ch;
                            } else {
                                chunk += ch;
                            }
                        }
                        line = chunk;
                    }
                }
            }
            if (line) result.push(line);
        });
        return result.length ? result : [''];
    }

    async function downloadSupervisorPNG() {
        haptic();
        showToast('Gerando Relatório HD...');
        const data = buildSupervisorDataset(supTeamFilter, supSortMode);
        const W = 2338;
        const font = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        const padX = 58, padTop = 50, contentW = W - padX * 2;
        const colDateW = 198, colTeamW = 412, colShiftW = 310;
        const colObsW = contentW - colDateW - colTeamW - colShiftW;

        /* Pré-medição exata de cada linha para nunca cortar observações longas */
        const mCanvas = document.createElement('canvas');
        const mCtx = mCanvas.getContext('2d');
        mCtx.font = `600 24px ${font}`;
        const measuredRows = data.entries.map(item => {
            const lines = wrapCanvasLines(mCtx, item.text, colObsW - 44);
            const tags = [];
            if (item.holiday) tags.push({ txt: `FERIADO: ${item.holiday.toUpperCase()}`, bg: '#fee2e2', fg: '#b91c1c', bd: '#fecaca' });
            if (item.isOv) tags.push({ txt: 'TROCA / HORA EXTRA', bg: '#fef3c7', fg: '#92400e', bd: '#fde68a' });
            if (item.isAt) tags.push({ txt: item.shiftLabel.toUpperCase(), bg: '#ffe4e6', fg: '#be123c', bd: '#fecdd3' });
            const textH = lines.length * 34;
            const tagsH = tags.length ? 42 : 0;
            const rowH = Math.max(106, textH + tagsH + 40);
            return { item, lines, tags, rowH };
        });

        const headerBottomY = padTop + 114 + 24;
        const kpiY = headerBottomY + 26, kpiH = 148;
        const tblY = kpiY + kpiH + 28, tblHeadH = 68;
        const rowsTotalH = measuredRows.length ? measuredRows.reduce((acc, r) => acc + r.rowH, 0) : 260;
        const signBlockH = 136, footerBlockH = 74;
        const neededH = tblY + tblHeadH + rowsTotalH + signBlockH + footerBlockH + 44;
        const H = Math.max(1654, neededH);

        /* Proteção automática contra limite de 16.7MP do Canvas no iOS Safari */
        const MAX_PIXELS = 15500000;
        const pixelScale = (W * H > MAX_PIXELS) ? Math.sqrt(MAX_PIXELS / (W * H)) : 1;

        const c = document.createElement('canvas');
        c.width = Math.floor(W * pixelScale);
        c.height = Math.floor(H * pixelScale);
        const ctx = c.getContext('2d');
        if (pixelScale < 1) ctx.scale(pixelScale, pixelScale);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        /* 1. Cabeçalho Corporativo */
        const logoImg = await loadLogoImage();
        const logoSize = 114;
        canvasRoundRect(ctx, padX, padTop, logoSize, logoSize, 22);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 3; ctx.stroke();
        if (logoImg) {
            ctx.save();
            canvasRoundRect(ctx, padX + 3, padTop + 3, logoSize - 6, logoSize - 6, 19);
            ctx.clip();
            ctx.drawImage(logoImg, padX + 3, padTop + 3, logoSize - 6, logoSize - 6);
            ctx.restore();
        }

        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        ctx.fillStyle = '#0f172a'; ctx.font = `900 45px ${font}`;
        ctx.fillText('RELATÓRIO DE OBSERVAÇÕES — FECHAMENTO', padX + logoSize + 28, padTop + 12);
        ctx.fillStyle = '#475569'; ctx.font = `800 22px ${font}`;
        ctx.fillText('IMERYS • BRITAGEM ICP 1 • ENCARREGADO & SUPERVISOR DE BRITAGEM', padX + logoSize + 28, padTop + 74);

        ctx.font = `900 40px ${font}`;
        const pillW = Math.max(360, ctx.measureText(data.monthLabel).width + 76), pillH = 68;
        const pillX = W - padX - pillW, pillY = padTop + 4;
        canvasRoundRect(ctx, pillX, pillY, pillW, pillH, 18);
        ctx.fillStyle = '#0f172a'; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(data.monthLabel, pillX + pillW / 2, pillY + pillH / 2 + 1);

        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#475569'; ctx.font = `700 20px ${font}`;
        ctx.fillText(canvasTruncateText(ctx, `${data.scopeLabel} • ${data.sortLabel}`, 920), W - padX, pillY + pillH + 14);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(padX, headerBottomY, contentW, 5);

        /* 2. Faixa de KPIs */
        const gap = 22;
        const kw1 = Math.round((contentW - gap * 3) * 0.20);
        const kw2 = Math.round((contentW - gap * 3) * 0.20);
        const kw3 = Math.round((contentW - gap * 3) * 0.37);
        const kw4 = contentW - gap * 3 - kw1 - kw2 - kw3;
        const kx1 = padX, kx2 = kx1 + kw1 + gap, kx3 = kx2 + kw2 + gap, kx4 = kx3 + kw3 + gap;

        const drawKpi = (x, w, label, val, sub) => {
            canvasRoundRect(ctx, x, kpiY, w, kpiH, 18);
            ctx.fillStyle = '#f8fafc'; ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#475569'; ctx.font = `900 18px ${font}`;
            ctx.fillText(label, x + 24, kpiY + 20);
            if (val !== null) {
                ctx.fillStyle = '#0f172a'; ctx.font = `900 44px ${font}`;
                ctx.fillText(String(val), x + 24, kpiY + 50);
            }
            if (sub) {
                ctx.fillStyle = '#64748b'; ctx.font = `700 19px ${font}`;
                ctx.fillText(sub, x + 24, kpiY + 106);
            }
        };

        drawKpi(kx1, kw1, 'OBSERVAÇÕES NO MÊS', data.totalNotes, data.teamFilter === 'all' ? 'Todos os turnos' : `de ${data.totalAllMonth} no mês`);
        drawKpi(kx2, kw2, 'DIAS COM REGISTRO', data.uniqueDays, `de ${data.daysInMonth} dias do mês`);
        drawKpi(kx3, kw3, 'OBSERVAÇÕES POR TURNO', null, '');

        const chipGap = 14, chipW = Math.floor((kw3 - 48 - chipGap * 3) / 4);
        TEAM_LETTERS.forEach((ltr, idx) => {
            const cx = kx3 + 24 + idx * (chipW + chipGap), cy = kpiY + 58;
            const isDim = data.teamFilter !== 'all' && String(idx) !== String(data.teamFilter);
            ctx.save();
            if (isDim) ctx.globalAlpha = 0.45;
            canvasRoundRect(ctx, cx, cy, chipW, 66, 12);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#64748b'; ctx.font = `800 16px ${font}`;
            ctx.fillText(`TURNO ${ltr}`, cx + chipW / 2, cy + 9);
            ctx.fillStyle = '#0f172a'; ctx.font = `900 26px ${font}`;
            ctx.fillText(String(data.perTeam[idx] || 0), cx + chipW / 2, cy + 32);
            ctx.restore();
        });
        drawKpi(kx4, kw4, 'EXTRAS / ATESTADOS', data.specialCount, 'Ocorrências c/ obs.');

        /* 3. Tabela de Observações */
        const colX0 = padX;
        const colX1 = colX0 + colDateW;
        const colX2 = colX1 + colTeamW;
        const colX3 = colX2 + colShiftW;
        const tblTotalH = tblHeadH + rowsTotalH;

        ctx.save();
        canvasRoundRect(ctx, padX, tblY, contentW, tblTotalH, 16);
        ctx.clip();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(padX, tblY, contentW, tblHeadH);
        ctx.fillStyle = '#ffffff'; ctx.font = `900 20px ${font}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const thMidY = tblY + tblHeadH / 2 + 1;
        ctx.fillText('DATA', colX0 + 22, thMidY);
        ctx.fillText('TURNO / EQUIPE', colX1 + 22, thMidY);
        ctx.fillText('ESCALA DO DIA', colX2 + 22, thMidY);
        ctx.fillText('OBSERVAÇÃO REGISTRADA', colX3 + 22, thMidY);

        let curY = tblY + tblHeadH;
        if (!measuredRows.length) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(padX, curY, contentW, 260);
            ctx.fillStyle = '#64748b'; ctx.font = `700 26px ${font}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Nenhuma observação registrada para o filtro selecionado neste mês.', padX + contentW / 2, curY + 130);
            curY += 260;
        } else {
            measuredRows.forEach((row, rIdx) => {
                const { item, lines, tags, rowH } = row;
                ctx.fillStyle = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                ctx.fillRect(padX, curY, contentW, rowH);

                /* Divisória horizontal + verticais */
                ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(padX, curY); ctx.lineTo(padX + contentW, curY);
                [colX1, colX2, colX3].forEach(vx => { ctx.moveTo(vx, curY); ctx.lineTo(vx, curY + rowH); });
                ctx.stroke();

                /* Data */
                const isRed = item.isSunday || Boolean(item.holiday);
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillStyle = isRed ? '#dc2626' : '#0f172a'; ctx.font = `900 28px ${font}`;
                ctx.fillText(item.dateStr, colX0 + 22, curY + 22);
                ctx.fillStyle = isRed ? '#ef4444' : '#64748b'; ctx.font = `800 19px ${font}`;
                ctx.fillText(item.dowPretty.toUpperCase(), colX0 + 22, curY + 58);

                /* Turno / Equipe */
                canvasRoundRect(ctx, colX1 + 22, curY + 22, 42, 42, 10);
                ctx.fillStyle = '#0f172a'; ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.font = `900 22px ${font}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(item.letter, colX1 + 43, curY + 44);

                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillStyle = '#0f172a'; ctx.font = `900 23px ${font}`;
                ctx.fillText(`Turno ${item.letter}`, colX1 + 78, curY + 20);
                ctx.fillStyle = '#475569'; ctx.font = `700 19px ${font}`;
                ctx.fillText(canvasTruncateText(ctx, item.teamName, colTeamW - 96), colX1 + 78, curY + 50);

                /* Escala do Dia */
                const pal = PALETTE[item.code] || PALETTE.M;
                canvasRoundRect(ctx, colX2 + 22, curY + 22, 56, 40, 10);
                ctx.fillStyle = pal.bg; ctx.fill();
                ctx.fillStyle = pal.fg; ctx.font = `900 21px ${font}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(item.code, colX2 + 50, curY + 43);

                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillStyle = '#0f172a'; ctx.font = `800 20px ${font}`;
                ctx.fillText(canvasTruncateText(ctx, item.shiftLabel, colShiftW - 104), colX2 + 90, curY + 21);
                ctx.fillStyle = '#64748b'; ctx.font = `700 18px ${font}`;
                ctx.fillText(item.shiftHours, colX2 + 90, curY + 49);

                /* Observação + Tags */
                let textY = curY + 20;
                if (tags.length) {
                    let tx = colX3 + 22;
                    ctx.font = `900 15px ${font}`;
                    tags.forEach(tg => {
                        const tw = ctx.measureText(tg.txt).width + 22;
                        if (tx + tw > colX3 + colObsW - 20) return;
                        canvasRoundRect(ctx, tx, textY, tw, 28, 7);
                        ctx.fillStyle = tg.bg; ctx.fill();
                        ctx.strokeStyle = tg.bd; ctx.lineWidth = 1.5; ctx.stroke();
                        ctx.fillStyle = tg.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                        ctx.fillText(tg.txt, tx + 11, textY + 15);
                        tx += tw + 10;
                    });
                    textY += 40;
                }

                ctx.fillStyle = '#0f172a'; ctx.font = `600 24px ${font}`;
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                lines.forEach((ln, li) => {
                    ctx.fillText(ln, colX3 + 22, textY + li * 34);
                });

                curY += rowH;
            });
        }
        ctx.restore();

        canvasRoundRect(ctx, padX, tblY, contentW, tblTotalH, 16);
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.stroke();

        /* 4. Área de Vistos / Fechamento */
        const signY = Math.max(curY + 34, H - footerBlockH - signBlockH);
        const signGap = 56;
        const signW = (contentW - signGap * 2) / 3;
        ['Encarregado de Britagem', 'Supervisor de Britagem', 'Data de Fechamento'].forEach((lbl, idx) => {
            const sx = padX + idx * (signW + signGap);
            ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(sx, signY + 62);
            ctx.lineTo(sx + signW, signY + 62);
            ctx.stroke();
            ctx.fillStyle = '#334155'; ctx.font = `800 19px ${font}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(lbl, sx + signW / 2, signY + 74);
        });

        /* 5. Rodapé */
        const footY = H - 54;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(padX, footY - 14, contentW, 2);
        ctx.textBaseline = 'top'; ctx.fillStyle = '#64748b'; ctx.font = `700 19px ${font}`;
        ctx.textAlign = 'left';
        ctx.fillText('Imerys • Britagem ICP 1 • Relatório Gerencial de Observações (Fechamento Mensal)', padX, footY);
        ctx.textAlign = 'right';
        ctx.fillText(`Emitido em ${data.issuedStr} • Formato A4 Horizontal (HD)`, W - padX, footY);

        /* 6. Download seguro em iOS, Android e PC */
        const suffix = data.teamFilter === 'all' ? 'Todos' : `Turno_${TEAM_LETTERS[parseInt(data.teamFilter, 10)]}`;
        const fileName = `Relatorio_Supervisor_Imerys_${suffix}_${data.mmStr}_${data.year}.png`;
        const triggerDl = (href, isBlob) => {
            const a = document.createElement('a');
            a.href = href;
            a.setAttribute('download', fileName);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            if (isBlob) setTimeout(() => window.URL.revokeObjectURL(href), 2500);
            showToast('Relatório HD (.PNG) baixado!');
        };

        if (typeof c.toBlob === 'function') {
            c.toBlob((blob) => {
                if (blob) triggerDl(window.URL.createObjectURL(blob), true);
                else {
                    try { triggerDl(c.toDataURL('image/png'), false); }
                    catch (e) { showToast('Não foi possível gerar a imagem.'); }
                }
            }, 'image/png');
        } else {
            try { triggerDl(c.toDataURL('image/png'), false); }
            catch (e) { showToast('Não foi possível gerar a imagem.'); }
        }
    }

    /* 7. COPIAR TEXTO FORMATADO (WHATSAPP / E-MAIL) */
    function copyTextFallback(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
    }

    async function copySupervisorSummary() {
        haptic();
        const data = buildSupervisorDataset(supTeamFilter, supSortMode);
        const lines = [
            `*RELATÓRIO DE OBSERVAÇÕES — FECHAMENTO MENSAL*`,
            `Imerys • Britagem ICP 1`,
            `Período: *${data.monthLabel}*`,
            `Escopo: ${data.scopeLabel} | ${data.sortLabel}`,
            `Resumo: *${data.totalNotes}* observação(ões) em *${data.uniqueDays}* dia(s) | Extras/Atestados: ${data.specialCount}`,
            `Por turno: A (${data.perTeam[0]}) • B (${data.perTeam[1]}) • C (${data.perTeam[2]}) • D (${data.perTeam[3]})`,
            `----------------------------------------`
        ];

        if (!data.entries.length) {
            lines.push('Nenhuma observação registrada para o filtro selecionado neste mês.');
        } else {
            data.entries.forEach(item => {
                const flags = [];
                if (item.holiday) flags.push(`Feriado: ${item.holiday}`);
                if (item.isOv) flags.push('Troca/Extra');
                if (item.isAt) flags.push(item.shiftLabel);
                const flagStr = flags.length ? ` [${flags.join(' • ')}]` : '';
                const shiftTxt = item.isAt ? item.shiftLabel : `${item.shiftLabel}${item.shiftHours ? ` (${item.shiftHours})` : ''}`;
                lines.push(`• *${item.dateStr} (${item.dowPretty})* — *Turno ${item.letter}* (${item.teamName}) — ${shiftTxt}${flagStr}`);
                lines.push(`  ${item.text.replace(/\r?\n/g, '\n  ')}`);
            });
        }
        lines.push(`----------------------------------------`);
        lines.push(`Emitido em ${data.issuedStr}`);

        const payload = lines.join('\n');
        let copied = false;
        if (navigator.clipboard && window.isSecureContext) {
            try { await navigator.clipboard.writeText(payload); copied = true; } catch (e) { copied = false; }
        }
        if (!copied) copied = copyTextFallback(payload);
        showToast(copied ? 'Relatório copiado! Cole no WhatsApp ou e-mail.' : 'Não foi possível copiar automaticamente.');
    }

    /* 8. INTEGRAÇÃO LIMPA COM AS FUNÇÕES EXISTENTES DO INDEX.HTML */
    const origDownloadA4PNG = window.downloadA4PNG;

    window.switchExportMode = function (mode) {
        if (mode !== 'quadro' && mode !== 'supervisor') return;
        haptic();
        exportMode = mode;
        refreshAllExportOutputs();
    };

    window.setSupervisorTeamFilter = function (val) {
        haptic();
        supTeamFilter = String(val);
        refreshAllExportOutputs();
    };

    window.setSupervisorSortMode = function (mode) {
        haptic();
        supSortMode = mode === 'team' ? 'team' : 'date';
        refreshAllExportOutputs();
    };

    window.scaleA4Preview = applyScaledPreview;
    window.refreshA4Outputs = refreshAllExportOutputs;

    window.openExportModal = function () {
        haptic();
        upgradeExportModalDOM();
        const cb = document.getElementById('a4-include-changes');
        if (cb) cb.checked = a4IncludeChanges;
        refreshAllExportOutputs();
        openAnimatedModal('export', 'export-modal', 'export-modal-content', () => applyScaledPreview());
    };

    window.printA4Schedule = function () {
        haptic();
        const data = refreshAllExportOutputs();
        const originalTitle = document.title;
        document.title = exportMode === 'supervisor'
            ? `Relatorio_Supervisor_Imerys_${data.mmStr}_${data.year}`
            : `Escala_Imerys_Quadro_A4_${data.mmStr}_${data.year}`;
        const restore = () => { document.title = originalTitle; };
        window.addEventListener('afterprint', restore, { once: true });
        setTimeout(() => {
            window.print();
            setTimeout(restore, 1500);
        }, 60);
    };

    window.triggerExportPNG = function () {
        if (exportMode === 'supervisor') return downloadSupervisorPNG();
        if (typeof origDownloadA4PNG === 'function') return origDownloadA4PNG();
    };

    window.copySupervisorSummary = copySupervisorSummary;

    /* Roda depois do beforeprint original para respeitar a aba ativa no Ctrl+P */
    function bindSupervisorPrintHook() {
        window.addEventListener('beforeprint', () => {
            const printEl = document.getElementById('print-sheet');
            if (!printEl) return;
            const exportOpen = !document.getElementById('export-modal')?.classList.contains('hidden');
            if (exportOpen && exportMode === 'supervisor') {
                printEl.classList.add('is-supervisor-print');
                printEl.innerHTML = buildSupervisorSheetHTML(buildSupervisorDataset(supTeamFilter, supSortMode));
            } else {
                printEl.classList.remove('is-supervisor-print');
            }
        });
    }

    function initSupervisorModule() {
        injectSupervisorStyles();
        upgradeExportModalDOM();
        bindSupervisorPrintHook();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupervisorModule);
    } else {
        initSupervisorModule();
    }
})();
