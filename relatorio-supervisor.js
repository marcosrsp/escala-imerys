/* ============================================================================
   MÓDULO COMPLETO: OCORRÊNCIAS POR FUNCIONÁRIO, ATESTADO UNIFICADO,
   OBSERVAÇÕES NA TELA PRINCIPAL E RELATÓRIO DO ENCARREGADO / SUPERVISOR
   Escala Imerys • Britagem ICP 1 (iOS Safari/PWA, Android Chrome e PC 60-144Hz)
   ============================================================================ */
(function () {
    if (window.__IMERYS_SUPERVISOR_LOADED__) return;
    window.__IMERYS_SUPERVISOR_LOADED__ = true;

    const META_STORAGE_KEY = 'imerys_override_meta';
    if (Array.isArray(STORAGE_KEYS) && !STORAGE_KEYS.includes(META_STORAGE_KEY)) {
        STORAGE_KEYS.push(META_STORAGE_KEY);
    }

    let exportMode = 'quadro'; // 'quadro' | 'supervisor'
    let supTeamFilter = 'all'; // 'all' | '0' | '1' | '2' | '3'
    let supSortMode = 'date';  // 'date' | 'team'

    let overrideMetaDb = {};
    let modalAtestadoWho = 'both';
    let modalOverrideWho = '0';
    let modalSwapWith = '';
    let modalSwapWithTeam = '';
    let printHookBound = false;

    /* Estende SHIFTS_CONFIG com a categoria Falta (FA) */
    if (typeof SHIFTS_CONFIG === 'object' && SHIFTS_CONFIG) {
        SHIFTS_CONFIG.FA = {
            name: 'Falta',
            hours: '',
            style: 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 font-black ring-2 ring-inset ring-red-500/80 dark:ring-red-500/70'
        };
    }

    const OVERRIDE_META = {
        HE50:  { code: '50%',  chip: '50%',  label: 'Hora Extra 50%',   short: 'HE 50%',     kind: 'extra' },
        HE75:  { code: '75%',  chip: '75%',  label: 'Hora Extra 75%',   short: 'HE 75%',     kind: 'extra' },
        HE110: { code: '110%', chip: '110%', label: 'Hora Extra 110%',  short: 'HE 110%',    kind: 'extra' },
        TD:    { code: 'TD',   chip: 'TD',   label: 'Troca de Dia',     short: 'Troca',      kind: 'troca' },
        F:     { code: 'F',    chip: 'F',    label: 'Folga',            short: 'Folga',      kind: 'folga' },
        FA:    { code: 'FA',   chip: 'FA',   label: 'Falta',            short: 'Falta',      kind: 'falta' },
        EA:    { code: 'EA',   chip: 'EA',   label: 'Entrada Atrasada', short: 'Ent. Atr.',  kind: 'atraso' },
        SA:    { code: 'SA',   chip: 'SA',   label: 'Saída Adiantada',  short: 'Saída Ant.', kind: 'saida' }
    };

    const VALID_OVERRIDES = ['HE50', 'HE75', 'HE110', 'TD', 'F', 'FA', 'EA', 'SA', 'M', 'T', 'N'];

    const PALETTE = {
        M:  { bg: '#dbeafe', fg: '#1e40af' },
        T:  { bg: '#ffedd5', fg: '#9a3412' },
        N:  { bg: '#e0e7ff', fg: '#3730a3' },
        F:  { bg: '#dcfce7', fg: '#15803d' },
        AT: { bg: '#ffe4e6', fg: '#be123c' },
        FA: { bg: '#fee2e2', fg: '#b91c1c' },
        HE: { bg: '#fef3c7', fg: '#92400e' },
        TD: { bg: '#f3e8ff', fg: '#6b21a8' },
        EA: { bg: '#cffafe', fg: '#0e7490' },
        SA: { bg: '#ccfbf1', fg: '#0f766e' }
    };

    /* ------------------------------------------------------------------------
       1. PERSISTÊNCIA ESTENDIDA (localStorage + IndexedDB) E SANITIZAÇÃO
       ------------------------------------------------------------------------ */
    function isValidDateKey(str) {
        return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
    }

    function sanitizeAllData() {
        const parsedTurma = parseInt(currentTurma, 10);
        currentTurma = (!isNaN(parsedTurma) && parsedTurma >= 0 && parsedTurma <= 3) ? parsedTurma : 2;

        teamNames = sanitizeTeamList(teamNames);

        const cleanNotes = {};
        if (notesDb && typeof notesDb === 'object' && !Array.isArray(notesDb)) {
            Object.entries(notesDb).forEach(([k, val]) => {
                if (val == null) return;
                const txt = String(val).trim();
                if (txt) cleanNotes[k] = txt;
            });
        }
        notesDb = cleanNotes;

        const cleanOv = {};
        if (overridesDb && typeof overridesDb === 'object' && !Array.isArray(overridesDb)) {
            Object.entries(overridesDb).forEach(([k, val]) => {
                if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k) && VALID_OVERRIDES.includes(val)) {
                    cleanOv[k] = val;
                }
            });
        }
        overridesDb = cleanOv;

        const cleanMeta = {};
        if (overrideMetaDb && typeof overrideMetaDb === 'object' && !Array.isArray(overrideMetaDb)) {
            Object.entries(overrideMetaDb).forEach(([k, val]) => {
                if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k) && val && typeof val === 'object') {
                    const wt = ['0', '1', 'both'].includes(String(val.whoType)) ? String(val.whoType) : 'both';
                    cleanMeta[k] = {
                        whoType: wt,
                        whoName: typeof val.whoName === 'string' ? val.whoName.trim().slice(0, 40) : '',
                        swapWith: typeof val.swapWith === 'string' ? val.swapWith.trim().slice(0, 40) : '',
                        swapWithTeam: typeof val.swapWithTeam === 'string' ? val.swapWithTeam.trim().slice(0, 2) : ''
                    };
                }
            });
        }
        overrideMetaDb = cleanMeta;

        const cleanAt = [];
        if (Array.isArray(atestadosDb)) {
            atestadosDb.forEach((rec, idx) => {
                if (!rec || typeof rec !== 'object' || !isValidDateKey(rec.startDate)) return;
                const tIdx = parseInt(rec.turma, 10);
                if (isNaN(tIdx) || tIdx < 0 || tIdx > 3) return;
                const days = Math.max(1, Math.min(180, parseInt(rec.days, 10) || 1));
                const wt = ['0', '1', 'both'].includes(String(rec.whoType)) ? String(rec.whoType) : 'both';
                cleanAt.push({
                    id: (typeof rec.id === 'string' && rec.id.trim()) ? rec.id.trim() : `at_${rec.startDate}_${tIdx}_${idx}`,
                    turma: tIdx,
                    startDate: rec.startDate,
                    days,
                    whoType: wt,
                    whoName: typeof rec.whoName === 'string' ? rec.whoName.trim().slice(0, 40) : ''
                });
            });
        }
        atestadosDb = cleanAt;
    }

    window.getNote = function (dateKey, turmaIdx) {
        const val = notesDb[getNoteKey(dateKey, turmaIdx)];
        return typeof val === 'string' ? val : (val == null ? '' : String(val));
    };

    function loadOverrideMetaFromDB() {
        overrideMetaDb = safeParseJSON(DB.get(META_STORAGE_KEY), {}, 'object');
    }

    loadOverrideMetaFromDB();
    sanitizeAllData();

    const origHydrate = window.hydrateStateFromDB;
    window.hydrateStateFromDB = function () {
        if (typeof origHydrate === 'function') origHydrate();
        loadOverrideMetaFromDB();
        sanitizeAllData();
    };

    DB.flushAll = function () {
        return [
            this.set('imerys_turma', currentTurma),
            this.set('imerys_notes', JSON.stringify(notesDb)),
            this.set('imerys_overrides', JSON.stringify(overridesDb)),
            this.set('imerys_atestados', JSON.stringify(atestadosDb)),
            this.set('imerys_teams', JSON.stringify(teamNames)),
            this.set(META_STORAGE_KEY, JSON.stringify(overrideMetaDb))
        ].every(Boolean);
    };

    /* ------------------------------------------------------------------------
       3. ESTILOS DO MÓDULO (FALTA, TROCA, ATESTADO, EA/SA E RELATÓRIO A4)
       ------------------------------------------------------------------------ */
    function injectModuleStyles() {
        if (document.getElementById('supervisor-report-styles')) return;
        const style = document.createElement('style');
        style.id = 'supervisor-report-styles';
        style.textContent = `
            .a4-cell-FA { background: #fee2e2; color: #b91c1c; box-shadow: inset 0 0 0 2px #dc2626; }
            .a4-cell-HE { background: #fef3c7; color: #92400e; }
            .a4-cell-TD { background: #f3e8ff; color: #6b21a8; }
            .a4-cell-EA { background: #cffafe; color: #0e7490; }
            .a4-cell-SA { background: #ccfbf1; color: #0f766e; }
            .a4-cell-td { box-shadow: inset 0 0 0 2.5px #7c3aed; }
            .a4-cell-ea { box-shadow: inset 0 0 0 2.5px #0891b2; }
            .a4-cell-sa { box-shadow: inset 0 0 0 2.5px #0d9488; }
            .a4-cell-who {
                display: block;
                font-size: 6.5px;
                font-weight: 800;
                line-height: 1;
                margin-top: 1px;
                max-width: 100%;
                padding: 0 1px;
                box-sizing: border-box;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .a4-preview-frame.is-sup-preview {
                aspect-ratio: auto !important;
                max-height: 44vh;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch;
            }
            .a4-preview-spacer { position: relative; width: 100%; min-height: 100%; }
            .a4-preview-frame.is-sup-preview .a4-preview-scaler { height: auto !important; }

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
                grid-template-columns: repeat(7, 1fr) 1.25fr;
                gap: 8px;
            }
            .sup-kpi-card {
                border: 1.2px solid #cbd5e1;
                border-radius: 10px;
                background: #f8fafc;
                padding: 8px 10px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                border-top-width: 3px;
            }
            .sup-kpi-card.is-total {
                background: #0f172a;
                border-color: #0f172a;
                color: #ffffff;
            }
            .sup-kpi-label {
                font-size: 8px;
                font-weight: 900;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                color: #475569;
                line-height: 1.2;
            }
            .sup-kpi-card.is-total .sup-kpi-label { color: #cbd5e1; }
            .sup-kpi-val {
                font-size: 22px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.1;
                margin-top: 4px;
                font-variant-numeric: tabular-nums;
            }
            .sup-kpi-card.is-total .sup-kpi-val { color: #ffffff; }
            .sup-kpi-sub {
                font-size: 8.5px;
                font-weight: 700;
                color: #94a3b8;
                margin-top: 2px;
            }
            .sup-meta-bar {
                margin-top: 8px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 6px 12px;
                border-radius: 8px;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                font-size: 10px;
                font-weight: 800;
                color: #334155;
            }
            .sup-meta-teams { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            .sup-meta-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 2px 7px;
                font-size: 9.5px;
                font-weight: 900;
                color: #0f172a;
                font-variant-numeric: tabular-nums;
            }
            .sup-meta-chip.is-dim { opacity: 0.45; }

            .sup-table-wrap {
                margin-top: 12px;
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

            .sup-col-date { width: 88px; }
            .sup-col-team { width: 196px; }
            .sup-col-shift { width: 282px; }

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
                font-size: 10.5px;
                font-weight: 700;
                color: #475569;
                margin-top: 2px;
                word-break: break-word;
            }

            .sup-shift-cell { display: flex; align-items: flex-start; gap: 8px; }
            .sup-shift-chip {
                min-width: 34px;
                height: 22px;
                padding: 0 5px;
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 900;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .sup-shift-name {
                display: block;
                font-size: 11.2px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.28;
                word-break: break-word;
            }
            .sup-shift-hours {
                display: block;
                font-size: 9.8px;
                font-weight: 700;
                color: #475569;
                margin-top: 2px;
                font-variant-numeric: tabular-nums;
            }

            .sup-obs-text {
                font-size: 12px;
                font-weight: 600;
                color: #0f172a;
                line-height: 1.42;
                white-space: pre-wrap;
                word-break: break-word;
            }
            .sup-obs-empty { color: #94a3b8; font-weight: 700; }
            .sup-empty-box {
                padding: 48px 24px;
                text-align: center;
                background: #f8fafc;
                color: #64748b;
                font-size: 13px;
                font-weight: 700;
            }

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
                #print-sheet.is-supervisor-print .sup-table thead { display: table-header-group !important; }
                #print-sheet.is-supervisor-print .sup-table tbody tr,
                #print-sheet.is-supervisor-print .sup-sign-grid,
                #print-sheet.is-supervisor-print .a4-footer {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------------
       4. ESTRUTURA DE DOM: CARD UNIFICADO DE OBSERVAÇÕES E MODAIS
       ------------------------------------------------------------------------ */
    function ensureObservationsCardDOM() {
        const grid = document.getElementById('bottom-cards-grid');
        if (!grid) return null;

        /* Mantém o card legado de atestado oculto (unificado dentro de Observações do Mês) */
        const legacyAt = document.getElementById('atestado-summary-section');
        if (legacyAt) legacyAt.classList.add('hidden');

        let sec = document.getElementById('observations-summary-section');
        if (sec) return sec;

        sec = document.createElement('section');
        sec.id = 'observations-summary-section';
        sec.className = 'hidden bg-slate-50 dark:bg-surface border border-slate-200 dark:border-surfaceBorder rounded-2xl p-4 md:p-5';
        sec.innerHTML = `
            <div class="flex items-center justify-between gap-2 mb-3">
                <h3 class="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 flex items-center gap-2 min-w-0">
                    <svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <span id="observations-summary-title" class="truncate">Observações do Mês</span>
                </h3>
                <span id="observations-summary-badge" class="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black tabular-nums shrink-0"></span>
            </div>
            <div id="observations-summary-container" class="space-y-2.5"></div>
        `;

        const holidaysSec = document.getElementById('holidays-list');
        if (holidaysSec && holidaysSec.parentNode === grid) {
            grid.insertBefore(sec, holidaysSec);
        } else {
            grid.appendChild(sec);
        }
        return sec;
    }

    function upgradeInfoModalDOM() {
        const panel = document.getElementById('info-modal-content');
        if (!panel || panel.dataset.v5Upgraded === '1') return;
        panel.dataset.v5Upgraded = '1';

        panel.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-black text-slate-800 dark:text-white leading-tight">Legenda</h3>
                <button type="button" onclick="closeInfoModal()" class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-surfaceBorder dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-slate-300 cursor-pointer btn-smooth" aria-label="Fechar legenda">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="space-y-2">
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30"><div class="flex items-center gap-2.5"><span class="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 font-black text-xs">M</span><span class="font-bold text-slate-700 dark:text-slate-200 text-sm">Manhã</span></div><span class="font-black text-blue-700 dark:text-blue-400 text-xs">05:00 - 13:00</span></div>
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30"><div class="flex items-center gap-2.5"><span class="w-7 h-7 flex items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-800/50 text-orange-700 dark:text-orange-300 font-black text-xs">T</span><span class="font-bold text-slate-700 dark:text-slate-200 text-sm">Tarde</span></div><span class="font-black text-orange-700 dark:text-orange-400 text-xs">13:00 - 21:00</span></div>
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30"><div class="flex items-center gap-2.5"><span class="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 font-black text-xs">N</span><span class="font-bold text-slate-700 dark:text-slate-200 text-sm">Noite</span></div><span class="font-black text-indigo-700 dark:text-indigo-400 text-xs">21:00 - 05:00</span></div>
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30"><div class="flex items-center gap-2.5"><span class="w-7 h-7 flex items-center justify-center rounded-lg bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300 font-black text-xs">F</span><span class="font-bold text-slate-700 dark:text-slate-200 text-sm">Folga</span></div><span class="font-black text-green-700 dark:text-green-400 text-xs uppercase">Descanso</span></div>
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50"><div class="flex items-center gap-2.5"><span class="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-black text-[11px]">AT</span><span class="font-bold text-slate-700 dark:text-slate-200 text-sm">Atestado</span></div><span class="font-black text-rose-700 dark:text-rose-400 text-xs uppercase">Afastamento</span></div>
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50"><div class="flex items-center gap-2.5"><span class="w-7 h-7 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 font-black text-[11px]">FA</span><span class="font-bold text-slate-700 dark:text-slate-200 text-sm">Falta</span></div><span class="font-black text-red-700 dark:text-red-400 text-xs uppercase">Ausência</span></div>
                <div class="grid grid-cols-2 gap-1.5 pt-1">
                    <div class="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span><span class="text-[10.5px] font-bold text-amber-800 dark:text-amber-300 leading-tight">Hora Extra</span></div>
                    <div class="flex items-center gap-1.5 p-2 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40"><span class="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span><span class="text-[10.5px] font-bold text-purple-800 dark:text-purple-300 leading-tight">Troca de Dia</span></div>
                    <div class="flex items-center gap-1.5 p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/40"><span class="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0"></span><span class="text-[10.5px] font-bold text-cyan-800 dark:text-cyan-300 leading-tight">Entrada Atrasada</span></div>
                    <div class="flex items-center gap-1.5 p-2 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40"><span class="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0"></span><span class="text-[10.5px] font-bold text-teal-800 dark:text-teal-300 leading-tight">Saída Adiantada</span></div>
                </div>
                <div class="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/40"><span class="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></span><span class="text-[10.5px] font-bold text-sky-800 dark:text-sky-300 leading-tight">Dia de Volta (Retorno de Atestado)</span></div>
            </div>

            <div class="mt-5 pt-4 border-t border-slate-200 dark:border-surfaceBorder">
                <span class="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2.5 text-center">Backup de Equipes, Notas e Atestados</span>
                <div class="grid grid-cols-2 gap-2">
                    <button type="button" onclick="exportBackup()" class="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200/80 dark:bg-surfaceBorder dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 active:scale-95 btn-smooth cursor-pointer">Exportar</button>
                    <button type="button" onclick="document.getElementById('backup-file-input').click()" class="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200/80 dark:bg-surfaceBorder dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 active:scale-95 btn-smooth cursor-pointer">Importar</button>
                    <input type="file" id="backup-file-input" accept=".json" class="hidden" onchange="importBackup(event)">
                </div>
            </div>
        `;
    }

    function upgradeNoteModalDOM() {
        const panel = document.getElementById('modal-content');
        if (!panel || panel.dataset.v5Upgraded === '1') return;
        panel.dataset.v5Upgraded = '1';

        panel.innerHTML = `
            <div class="md:hidden w-12 h-1.5 bg-slate-300 dark:bg-surfaceBorder rounded-full mx-auto mb-4"></div>
            <div class="flex justify-between items-center mb-4">
                <h3 id="modal-date-title" class="text-lg font-black text-slate-800 dark:text-white leading-tight"></h3>
                <button type="button" onclick="requestCloseModal()" class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-surfaceBorder dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-slate-300 cursor-pointer btn-smooth" aria-label="Fechar janela">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <!-- Grade Unificada de Ocorrências (incluindo Entrada Atrasada, Saída Adiantada e Atestado Médico) -->
            <div class="mb-4">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Tipo de Ocorrência</span>
                    <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Toque novamente p/ limpar</span>
                </div>
                <div class="grid grid-cols-6 gap-1.5">
                    <button type="button" data-ov="HE50" onclick="selectOverride('HE50')" class="ov-btn col-span-2 py-2.5 px-1.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Hora Extra 50%</button>
                    <button type="button" data-ov="HE75" onclick="selectOverride('HE75')" class="ov-btn col-span-2 py-2.5 px-1.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Hora Extra 75%</button>
                    <button type="button" data-ov="HE110" onclick="selectOverride('HE110')" class="ov-btn col-span-2 py-2.5 px-1.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Hora Extra 110%</button>
                    <button type="button" data-ov="TD" onclick="selectOverride('TD')" class="ov-btn col-span-2 py-2.5 px-1.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Troca de Dia</button>
                    <button type="button" data-ov="F" onclick="selectOverride('F')" class="ov-btn col-span-2 py-2.5 px-1.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Folga</button>
                    <button type="button" data-ov="FA" onclick="selectOverride('FA')" class="ov-btn col-span-2 py-2.5 px-1.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Falta</button>
                    <button type="button" data-ov="EA" onclick="selectOverride('EA')" class="ov-btn col-span-3 py-2.5 px-2 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Entrada Atrasada</button>
                    <button type="button" data-ov="SA" onclick="selectOverride('SA')" class="ov-btn col-span-3 py-2.5 px-2 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer">Saída Adiantada</button>
                    <button type="button" data-ov="AT" onclick="selectOverride('AT')" class="ov-btn col-span-6 py-2.5 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 btn-smooth active:scale-[0.98] cursor-pointer">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                        <span>Atestado Médico</span>
                    </button>
                </div>

                <!-- Painel Dinâmico: Funcionário (HE / Falta / Entrada Atrasada / Saída Adiantada / Troca de Dia) -->
                <div id="override-details-box" class="hidden mt-3 rounded-2xl border p-3.5 space-y-3">
                    <div>
                        <span id="override-who-label" class="block text-[11px] font-extrabold mb-1.5"></span>
                        <div id="override-who-group" class="grid grid-cols-3 gap-1.5"></div>
                    </div>
                    <div id="swap-target-section" class="hidden pt-2.5 border-t border-purple-200/70 dark:border-purple-900/50 space-y-2">
                        <span class="block text-[11px] font-extrabold text-purple-900 dark:text-purple-200">Troca com quem?</span>
                        <div id="swap-presets-group" class="grid grid-cols-2 sm:grid-cols-3 gap-1.5"></div>
                        <input type="text" id="swap-custom-input" maxlength="40" autocomplete="off" oninput="onSwapCustomInput()" placeholder="Ou digite outro nome..." class="w-full px-3 py-2 text-base font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-oled border border-purple-200 dark:border-purple-900/60 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-slate-400 dark:placeholder:text-slate-500">
                    </div>
                </div>

                <!-- Painel Dinâmico: Atestado Médico -->
                <div id="atestado-controls" class="hidden mt-3 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/20 p-3.5 space-y-3">
                    <p id="atestado-origin-notice" class="hidden text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-white/70 dark:bg-oled/60 border border-rose-200 dark:border-rose-900/40 rounded-xl px-3 py-2 leading-snug"></p>
                    <div>
                        <span class="block text-[11px] font-extrabold text-rose-900 dark:text-rose-200 mb-1.5">Quem está de atestado:</span>
                        <div id="atestado-who-group" class="grid grid-cols-3 gap-1.5"></div>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] font-extrabold text-rose-900 dark:text-rose-200">Quantidade de dias:</span>
                        <div class="flex items-center gap-1.5">
                            <button type="button" onclick="adjustAtestadoDays(-1)" aria-label="Diminuir dias" class="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-black text-lg flex items-center justify-center active:scale-90 btn-smooth cursor-pointer">−</button>
                            <input type="number" id="atestado-days-input" inputmode="numeric" pattern="[0-9]*" min="1" max="180" value="1" oninput="onAtestadoDaysInput()" class="w-14 h-9 text-center text-base font-black text-rose-800 dark:text-rose-200 bg-white dark:bg-oled border border-rose-200 dark:border-rose-900/50 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 tabular-nums">
                            <button type="button" onclick="adjustAtestadoDays(1)" aria-label="Aumentar dias" class="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-black text-lg flex items-center justify-center active:scale-90 btn-smooth cursor-pointer">+</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-5 gap-1.5">
                        <button type="button" onclick="setAtestadoDays(1)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">1d</button>
                        <button type="button" onclick="setAtestadoDays(3)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">3d</button>
                        <button type="button" onclick="setAtestadoDays(5)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">5d</button>
                        <button type="button" onclick="setAtestadoDays(7)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">7d</button>
                        <button type="button" onclick="setAtestadoDays(15)" class="py-1.5 rounded-lg text-[11px] font-extrabold bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 active:scale-95 btn-smooth cursor-pointer">15d</button>
                    </div>
                    <div id="atestado-preview-box" class="rounded-xl bg-sky-50 dark:bg-sky-950/35 border border-sky-200 dark:border-sky-900/60 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 leading-snug"></div>
                </div>
            </div>

            <!-- Observação -->
            <textarea id="note-text" oninput="markModalDirty()" class="w-full h-24 md:h-28 p-3.5 text-base font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-oled border border-slate-200 dark:border-surfaceBorder rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600" placeholder="Observações para este dia..."></textarea>

            <!-- Aviso de alterações não salvas -->
            <div id="unsaved-guard" class="hidden mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/60 px-3 py-2.5 flex items-center justify-between gap-2">
                <span class="text-xs font-extrabold text-amber-800 dark:text-amber-300">Alterações não salvas</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" onclick="closeModal()" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-oled border border-slate-200 dark:border-surfaceBorder active:scale-95 btn-smooth cursor-pointer">Descartar</button>
                    <button type="button" onclick="saveNote()" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 btn-smooth cursor-pointer">Salvar</button>
                </div>
            </div>

            <div class="flex gap-3 mt-4 pb-2 md:pb-0">
                <button type="button" onclick="deleteNote()" class="w-1/3 py-3.5 rounded-2xl font-bold text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100/80 dark:bg-red-900/20 dark:hover:bg-red-900/35 border border-red-100 dark:border-red-900/30 active:scale-95 btn-smooth cursor-pointer">Limpar</button>
                <button type="button" onclick="saveNote()" class="w-2/3 py-3.5 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 active:scale-95 btn-smooth cursor-pointer">Salvar</button>
            </div>
        `;
    }

    function upgradeExportModalDOM() {
        const panel = document.getElementById('export-modal-content');
        if (!panel || panel.dataset.supUpgraded === '2') return;
        panel.dataset.supUpgraded = '2';

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

            <div class="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-oled border border-slate-200 dark:border-surfaceBorder mb-4">
                <button type="button" id="export-tab-quadro" onclick="switchExportMode('quadro')" class="py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 btn-smooth cursor-pointer">
                    <span>Quadro dos Turnos</span>
                </button>
                <button type="button" id="export-tab-supervisor" onclick="switchExportMode('supervisor')" class="py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 btn-smooth cursor-pointer">
                    <span>Ocorrências Mensais</span>
                    <span id="sup-tab-badge" class="px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums">0</span>
                </button>
            </div>

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
                        <button type="button" id="sup-sort-date-btn" data-sup-sort="date" onclick="setSupervisorSortMode('date')" class="sup-sort-btn py-1.5 px-3 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">Por Data (1 → 30)</button>
                        <button type="button" data-sup-sort="team" onclick="setSupervisorSortMode('team')" class="sup-sort-btn py-1.5 px-3 rounded-lg text-[11px] font-extrabold border btn-smooth cursor-pointer">Por Turno (A → D)</button>
                    </div>
                </div>
            </div>

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

            <label id="export-quadro-options" class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-oled border border-slate-200 dark:border-surfaceBorder mb-4 cursor-pointer">
                <div class="min-w-0">
                    <span class="block text-xs font-extrabold text-slate-800 dark:text-slate-100">Incluir ocorrências (extras, trocas, faltas, atrasos e atestados)</span>
                    <span class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Desligado imprime a escala oficial limpa de todos os turnos. Observações nunca aparecem.</span>
                </div>
                <input type="checkbox" id="a4-include-changes" onchange="onA4OptionsChange()" class="w-5 h-5 rounded accent-blue-600 shrink-0 cursor-pointer">
            </label>

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

            <button type="button" id="sup-copy-btn" onclick="copySupervisorSummary()" class="hidden w-full py-3 px-4 mb-4 rounded-2xl font-extrabold text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center gap-2 active:scale-95 btn-smooth cursor-pointer">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                <span>Copiar Relatório em Texto (WhatsApp / E-mail)</span>
            </button>

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

    function upgradeDesktopInlineLegend() {
        const legendRow = document.querySelector('section .hidden.md\\:flex.items-center.gap-3');
        if (!legendRow || legendRow.dataset.hasExtras === '2') return;
        legendRow.dataset.hasExtras = '2';
        [
            { cls: 'bg-red-600', label: 'Falta' },
            { cls: 'bg-purple-500', label: 'Troca' },
            { cls: 'bg-cyan-500', label: 'Atraso' },
            { cls: 'bg-teal-500', label: 'Saída Ant.' }
        ].forEach(it => {
            const span = document.createElement('span');
            span.className = 'flex items-center gap-1';
            span.innerHTML = `<span class="w-2 h-2 rounded-full ${it.cls}"></span>${it.label}`;
            legendRow.appendChild(span);
        });
    }

    /* ------------------------------------------------------------------------
       5. PAINÉIS INTERATIVOS DO MODAL DO DIA (HE, FALTA, EA, SA, TROCA E ATESTADO)
       ------------------------------------------------------------------------ */
    function syncOccurrenceButtonsUI() {
        const activeStyles = {
            HE50:  'bg-amber-500 border-amber-500 text-white shadow-sm',
            HE75:  'bg-amber-500 border-amber-500 text-white shadow-sm',
            HE110: 'bg-amber-600 border-amber-600 text-white shadow-sm',
            TD:    'bg-purple-600 border-purple-600 text-white shadow-sm',
            F:     'bg-green-600 border-green-600 text-white shadow-sm',
            FA:    'bg-red-600 border-red-600 text-white shadow-sm',
            EA:    'bg-cyan-600 border-cyan-600 text-white shadow-sm',
            SA:    'bg-teal-600 border-teal-600 text-white shadow-sm',
            AT:    'bg-rose-600 border-rose-600 text-white shadow-sm'
        };
        const idleStyle = 'bg-slate-50 hover:bg-slate-100 dark:bg-oled dark:hover:bg-zinc-900 border-slate-200 dark:border-surfaceBorder text-slate-600 dark:text-slate-300';
        const idleAtStyle = 'bg-rose-50/75 hover:bg-rose-100/70 dark:bg-rose-950/25 dark:hover:bg-rose-950/45 border-rose-200/90 dark:border-rose-900/60 text-rose-700 dark:text-rose-300';

        document.querySelectorAll('#note-modal .ov-btn').forEach(btn => {
            const val = btn.getAttribute('data-ov') || '';
            const isAtBtn = val === 'AT';
            const isHalfRow = val === 'EA' || val === 'SA';
            const isAct = isAtBtn ? modalAtestadoEnabled : (!modalAtestadoEnabled && val === currentSelectedOverride);
            let baseCls;
            if (isAtBtn) {
                baseCls = 'ov-btn col-span-6 py-2.5 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 btn-smooth active:scale-[0.98] cursor-pointer';
            } else if (isHalfRow) {
                baseCls = 'ov-btn col-span-3 py-2.5 px-2 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer';
            } else {
                baseCls = 'ov-btn col-span-2 py-2.5 px-1.5 rounded-xl text-xs font-extrabold border btn-smooth active:scale-95 cursor-pointer';
            }
            btn.className = `${baseCls} ${isAct ? (activeStyles[val] || activeStyles.HE50) : (isAtBtn ? idleAtStyle : idleStyle)}`;
        });
    }

    function renderAtestadoWhoButtons() {
        const group = document.getElementById('atestado-who-group');
        if (!group) return;
        const members = parseTeamMembers(teamNames[currentTurma]);
        let options;
        if (members.length >= 2) {
            options = [
                { val: '0', label: members[0] },
                { val: '1', label: members[1] },
                { val: 'both', label: 'Os dois' }
            ];
            group.className = 'grid grid-cols-3 gap-1.5';
        } else {
            const single = members[0] || teamNames[currentTurma];
            options = [{ val: '0', label: single }];
            modalAtestadoWho = '0';
            group.className = 'grid grid-cols-1 gap-1.5';
        }

        group.innerHTML = options.map(opt => {
            const act = modalAtestadoWho === opt.val;
            const cls = act
                ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                : 'bg-white hover:bg-rose-100/60 dark:bg-oled dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200';
            return `<button type="button" onclick="selectAtestadoWho('${opt.val}')" class="py-2 px-2 rounded-xl text-[11px] font-extrabold border truncate active:scale-95 btn-smooth cursor-pointer ${cls}" title="${escapeHTML(opt.label)}">${escapeHTML(opt.label)}</button>`;
        }).join('');
    }

    function renderOverrideDetailsUI() {
        const box = document.getElementById('override-details-box');
        const labelEl = document.getElementById('override-who-label');
        const whoGroup = document.getElementById('override-who-group');
        const swapSec = document.getElementById('swap-target-section');
        const swapGroup = document.getElementById('swap-presets-group');
        const swapInput = document.getElementById('swap-custom-input');
        if (!box || !labelEl || !whoGroup) return;

        const code = modalAtestadoEnabled ? '' : currentSelectedOverride;
        const isHE = code === 'HE50' || code === 'HE75' || code === 'HE110';
        const isFA = code === 'FA';
        const isEA = code === 'EA';
        const isSA = code === 'SA';
        const isTD = code === 'TD';

        if (!isHE && !isFA && !isEA && !isSA && !isTD) {
            box.classList.add('hidden');
            return;
        }

        box.classList.remove('hidden');

        let theme;
        if (isHE) {
            theme = {
                box: 'border-amber-200/90 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20',
                lbl: 'text-amber-900 dark:text-amber-200',
                act: 'bg-amber-500 border-amber-500 text-white shadow-sm',
                idle: 'bg-white hover:bg-amber-100/60 dark:bg-oled dark:hover:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200',
                title: `Quem fez a ${OVERRIDE_META[code].label}?`
            };
        } else if (isFA) {
            theme = {
                box: 'border-red-200/90 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20',
                lbl: 'text-red-900 dark:text-red-200',
                act: 'bg-red-600 border-red-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-red-100/60 dark:bg-oled dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200',
                title: 'Quem faltou neste dia?'
            };
        } else if (isEA) {
            theme = {
                box: 'border-cyan-200/90 dark:border-cyan-900/60 bg-cyan-50/70 dark:bg-cyan-950/20',
                lbl: 'text-cyan-900 dark:text-cyan-200',
                act: 'bg-cyan-600 border-cyan-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-cyan-100/60 dark:bg-oled dark:hover:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/50 text-cyan-900 dark:text-cyan-200',
                title: 'Quem teve entrada atrasada?'
            };
        } else if (isSA) {
            theme = {
                box: 'border-teal-200/90 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/20',
                lbl: 'text-teal-900 dark:text-teal-200',
                act: 'bg-teal-600 border-teal-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-teal-100/60 dark:bg-oled dark:hover:bg-teal-950/40 border-teal-200 dark:border-teal-900/50 text-teal-900 dark:text-teal-200',
                title: 'Quem teve saída adiantada?'
            };
        } else {
            theme = {
                box: 'border-purple-200/90 dark:border-purple-900/60 bg-purple-50/70 dark:bg-purple-950/20',
                lbl: 'text-purple-900 dark:text-purple-200',
                act: 'bg-purple-600 border-purple-600 text-white shadow-sm',
                idle: 'bg-white hover:bg-purple-100/60 dark:bg-oled dark:hover:bg-purple-950/40 border-purple-200 dark:border-purple-900/50 text-purple-800 dark:text-purple-200',
                title: `Quem do Turno ${TEAM_LETTERS[currentTurma]} está trocando?`
            };
        }

        box.className = `mt-3 rounded-2xl border p-3.5 space-y-3 ${theme.box}`;
        labelEl.className = `block text-[11px] font-extrabold mb-1.5 ${theme.lbl}`;
        labelEl.innerText = theme.title;

        const members = parseTeamMembers(teamNames[currentTurma]);
        let options;
        if (members.length >= 2) {
            options = [
                { val: '0', label: members[0] },
                { val: '1', label: members[1] },
                { val: 'both', label: 'Os dois' }
            ];
            whoGroup.className = 'grid grid-cols-3 gap-1.5';
        } else {
            const single = members[0] || teamNames[currentTurma];
            options = [{ val: '0', label: single }];
            modalOverrideWho = '0';
            whoGroup.className = 'grid grid-cols-1 gap-1.5';
        }

        whoGroup.innerHTML = options.map(opt => {
            const act = modalOverrideWho === opt.val;
            return `<button type="button" onclick="selectOverrideWho('${opt.val}')" class="py-2 px-2 rounded-xl text-[11px] font-extrabold border truncate active:scale-95 btn-smooth cursor-pointer ${act ? theme.act : theme.idle}" title="${escapeHTML(opt.label)}">${escapeHTML(opt.label)}</button>`;
        }).join('');

        if (swapSec && swapGroup && swapInput) {
            swapSec.classList.toggle('hidden', !isTD);
            if (isTD) {
                const presets = [];
                for (let tIdx = 0; tIdx < 4; tIdx++) {
                    if (tIdx === currentTurma) continue;
                    const tLtr = TEAM_LETTERS[tIdx];
                    const tMembers = parseTeamMembers(teamNames[tIdx]);
                    tMembers.forEach((mName, mIdx) => {
                        presets.push({ tIdx, mIdx, name: mName, teamLtr: tLtr });
                    });
                }

                let matchedPreset = false;
                swapGroup.innerHTML = presets.map(p => {
                    const isSelected = modalSwapWith.trim() === p.name && (modalSwapWithTeam === p.teamLtr || !modalSwapWithTeam);
                    if (isSelected) matchedPreset = true;
                    const cls = isSelected
                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                        : 'bg-white hover:bg-purple-100/60 dark:bg-oled dark:hover:bg-purple-950/40 border-purple-200 dark:border-purple-900/50 text-purple-900 dark:text-purple-200';
                    return `<button type="button" onclick="selectSwapPreset(${p.tIdx}, ${p.mIdx})" class="swap-preset-btn py-2 px-2 rounded-xl text-[11px] font-extrabold border truncate active:scale-95 btn-smooth cursor-pointer ${cls}" title="${escapeHTML(`${p.name} (Turno ${p.teamLtr})`)}">${escapeHTML(p.name)} <span class="opacity-70">(${p.teamLtr})</span></button>`;
                }).join('');

                if (document.activeElement !== swapInput) {
                    swapInput.value = matchedPreset ? '' : modalSwapWith;
                }
            }
        }
    }

    window.selectAtestadoWho = function (val, silent = false) {
        if (!silent) { haptic(); markModalDirty(); }
        modalAtestadoWho = String(val || 'both');
        renderAtestadoWhoButtons();
        updateAtestadoPreview();
    };

    window.selectOverrideWho = function (val, silent = false) {
        if (!silent) { haptic(); markModalDirty(); }
        modalOverrideWho = String(val || 'both');
        renderOverrideDetailsUI();
    };

    window.selectSwapPreset = function (tIdx, mIdx) {
        haptic();
        markModalDirty();
        const tLtr = TEAM_LETTERS[tIdx] || '';
        const tMembers = parseTeamMembers(teamNames[tIdx]);
        const name = tMembers[mIdx] || '';
        if (modalSwapWith === name && modalSwapWithTeam === tLtr) {
            modalSwapWith = '';
            modalSwapWithTeam = '';
        } else {
            modalSwapWith = name;
            modalSwapWithTeam = tLtr;
        }
        const swapInput = document.getElementById('swap-custom-input');
        if (swapInput) swapInput.value = '';
        renderOverrideDetailsUI();
    };

    window.onSwapCustomInput = function () {
        markModalDirty();
        const swapInput = document.getElementById('swap-custom-input');
        modalSwapWith = swapInput ? swapInput.value.slice(0, 40) : '';
        modalSwapWithTeam = '';
        const idleCls = 'swap-preset-btn py-2 px-2 rounded-xl text-[11px] font-extrabold border truncate active:scale-95 btn-smooth cursor-pointer bg-white hover:bg-purple-100/60 dark:bg-oled dark:hover:bg-purple-950/40 border-purple-200 dark:border-purple-900/50 text-purple-900 dark:text-purple-200';
        document.querySelectorAll('#swap-presets-group .swap-preset-btn').forEach(btn => {
            btn.className = idleCls;
        });
    };

    window.updateAtestadoPreview = function () {
        const pv = document.getElementById('atestado-preview-box');
        if (!pv || !modalAtestadoStartDate) return;
        const inp = document.getElementById('atestado-days-input');
        const days = Math.max(1, Math.min(180, parseInt(inp ? inp.value : '1', 10) || 1));
        const ret = computeReturnInfo(modalAtestadoStartDate, days, currentTurma, modalEditingAtestadoId);
        const sh = SHIFTS_CONFIG[ret.returnShiftCode] || SHIFTS_CONFIG.M;
        const who = getSelectionWhoInfo(modalAtestadoWho, currentTurma);
        const pTxt = days === 1
            ? `${formatShortDate(modalAtestadoStartDate)} (1 dia)`
            : `${formatShortDate(modalAtestadoStartDate)} até ${formatShortDate(ret.endDate)} (${days} dias)`;
        const skip = ret.skippedFolgas > 0
            ? `<span class="block text-[10px] font-semibold text-sky-700/80 dark:text-sky-300/80 mt-0.5">Pulando ${ret.skippedFolgas} folga(s) normal(is).</span>`
            : '';
        pv.innerHTML = `<span class="block font-bold text-slate-700 dark:text-slate-200">Funcionário: <b class="text-rose-600 dark:text-rose-300">${escapeHTML(who.fullLabel)}</b></span><span class="block font-bold text-slate-600 dark:text-slate-300 mt-0.5">Afastamento: <b class="text-rose-600 dark:text-rose-300">${pTxt}</b></span><span class="block font-extrabold text-sky-700 dark:text-sky-300 mt-1">↳ Retorno: ${formatReturnDateLabel(ret.returnDateKey)} • ${sh.name}${sh.hours ? ` (${sh.hours})` : ''}</span>${skip}`;
    };

    window.setAtestadoUI = function (enabled) {
        modalAtestadoEnabled = Boolean(enabled);
        const ctrl = document.getElementById('atestado-controls');
        const noteEl = document.getElementById('note-text');
        if (ctrl) ctrl.classList.toggle('hidden', !modalAtestadoEnabled);
        if (modalAtestadoEnabled) {
            if (!modalAtestadoStartDate) modalAtestadoStartDate = currentModalDateStr;
            if (noteEl) noteEl.placeholder = 'Observações ou motivo do atestado...';
            renderAtestadoWhoButtons();
            updateAtestadoPreview();
        } else {
            if (noteEl) noteEl.placeholder = 'Observações para este dia...';
        }
        syncOccurrenceButtonsUI();
        renderOverrideDetailsUI();
    };

    window.toggleAtestadoMode = function () {
        window.selectOverride('AT');
    };

    window.selectOverride = function (code, silent = false) {
        if (!silent) {
            haptic();
            markModalDirty();
        }

        if (code === 'AT') {
            const next = silent ? true : !modalAtestadoEnabled;
            if (next) {
                currentSelectedOverride = '';
                if (!modalAtestadoStartDate) modalAtestadoStartDate = currentModalDateStr;
            }
            setAtestadoUI(next);
            return;
        }

        if (!silent && code && currentSelectedOverride === code && !modalAtestadoEnabled) {
            code = '';
        }
        currentSelectedOverride = code || '';
        if (modalAtestadoEnabled) {
            setAtestadoUI(false);
        } else {
            syncOccurrenceButtonsUI();
            renderOverrideDetailsUI();
        }
    };

    window.openModal = function (dateKey) {
        if (!isValidDateKey(dateKey)) return;
        haptic();
        upgradeNoteModalDOM();
        currentModalDateStr = dateKey;
        const dt = parseDateKey(dateKey);
        const base = getShift(dt.getFullYear(), dt.getMonth(), dt.getDate(), currentTurma);
        const activeOv = overridesDb[`${dateKey}_${currentTurma}`] || '';
        const activeMeta = getOverrideMeta(dateKey, currentTurma);
        const existingAt = findAtestadoOnDate(dateKey, currentTurma);
        const members = parseTeamMembers(teamNames[currentTurma]);

        let badge = '';
        if (existingAt) {
            const whoInfo = resolveWhoInfo(existingAt.record, currentTurma);
            badge = ` • ATESTADO (${whoInfo.label})`;
        } else if (activeOv && OVERRIDE_META[activeOv]) {
            badge = ` • ${OVERRIDE_META[activeOv].label.toUpperCase()}`;
        } else if (activeOv) {
            badge = ' • ALTERADO';
        }

        const baseCfg = SHIFTS_CONFIG[base] || SHIFTS_CONFIG.M;
        const titleEl = document.getElementById('modal-date-title');
        if (titleEl) {
            titleEl.innerHTML = `Dia ${dt.getDate()} de ${MONTH_SHORT[dt.getMonth()]} <br><span class="text-[13px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Turno ${TEAM_LETTERS[currentTurma]} • ${escapeHTML(baseCfg.name)}${escapeHTML(badge)}</span>`;
        }
        const noteEl = document.getElementById('note-text');
        if (noteEl) noteEl.value = getNote(dateKey, currentTurma);

        modalOverrideWho = (activeMeta && activeMeta.whoType)
            ? String(activeMeta.whoType)
            : (activeOv ? 'both' : '0');
        modalSwapWith = (activeMeta && activeMeta.swapWith) ? String(activeMeta.swapWith) : '';
        modalSwapWithTeam = (activeMeta && activeMeta.swapWithTeam) ? String(activeMeta.swapWithTeam) : '';

        const originNotice = document.getElementById('atestado-origin-notice');
        const daysInp = document.getElementById('atestado-days-input');

        if (existingAt) {
            const whoInfo = resolveWhoInfo(existingAt.record, currentTurma);
            modalEditingAtestadoId = existingAt.record.id;
            modalAtestadoStartDate = existingAt.record.startDate;
            modalAtestadoWho = whoInfo.whoType;
            if (daysInp) daysInp.value = existingAt.record.days;
            if (originNotice) {
                if (existingAt.record.startDate !== dateKey) {
                    const startReason = getNote(existingAt.record.startDate, currentTurma);
                    originNotice.innerText = `Editando atestado de ${whoInfo.fullLabel} iniciado em ${formatShortDate(existingAt.record.startDate)}.${startReason ? ` Motivo registrado: "${startReason}".` : ''} Toque em Atestado Médico novamente para remover.`;
                    originNotice.classList.remove('hidden');
                } else {
                    originNotice.classList.add('hidden');
                }
            }
            currentSelectedOverride = '';
            setAtestadoUI(true);
        } else {
            modalEditingAtestadoId = null;
            modalAtestadoStartDate = dateKey;
            modalAtestadoWho = members.length >= 2 ? 'both' : '0';
            if (daysInp) daysInp.value = 1;
            if (originNotice) originNotice.classList.add('hidden');
            currentSelectedOverride = activeOv;
            setAtestadoUI(false);
        }

        modalDirty = false;
        document.getElementById('unsaved-guard')?.classList.add('hidden');
        openAnimatedModal('note', 'note-modal', 'modal-content');
    };

    window.saveNote = function (isClear = false) {
        if (!currentModalDateStr) return;
        const noteEl = document.getElementById('note-text');
        const v = noteEl ? noteEl.value.trim() : '';
        setNote(currentModalDateStr, currentTurma, v);
        let toastMsg = isClear ? 'Registro do dia limpo!' : 'Alterações salvas!';
        const ovKey = `${currentModalDateStr}_${currentTurma}`;

        if (modalAtestadoEnabled) {
            const daysInp = document.getElementById('atestado-days-input');
            const days = Math.max(1, Math.min(180, parseInt(daysInp ? daysInp.value : '1', 10) || 1));
            const startDate = modalAtestadoStartDate || currentModalDateStr;
            const who = getSelectionWhoInfo(modalAtestadoWho, currentTurma);
            const newRec = {
                id: modalEditingAtestadoId || `at_${Date.now()}`,
                turma: currentTurma,
                startDate,
                days,
                whoType: who.whoType,
                whoName: who.whoName
            };
            const newDates = new Set(getAtestadoDates(newRec));
            atestadosDb = atestadosDb.filter(r => r.id !== modalEditingAtestadoId && (r.turma !== currentTurma || !getAtestadoDates(r).some(d => newDates.has(d))));
            atestadosDb.push(newRec);
            newDates.forEach(d => {
                delete overridesDb[`${d}_${currentTurma}`];
                delete overrideMetaDb[`${d}_${currentTurma}`];
            });
            const ret = computeReturnInfo(startDate, days, currentTurma, newRec.id);
            const retName = (SHIFTS_CONFIG[ret.returnShiftCode] || SHIFTS_CONFIG.M).name;
            toastMsg = `Atestado (${who.label}) salvo! Retorno: ${formatShortDate(ret.returnDateKey)} (${retName})`;
        } else {
            if (modalEditingAtestadoId) {
                atestadosDb = atestadosDb.filter(r => r.id !== modalEditingAtestadoId);
                if (isClear) toastMsg = 'Atestado e registro do dia removidos.';
                else if (currentSelectedOverride) toastMsg = 'Atestado substituído com sucesso!';
                else toastMsg = 'Atestado removido da escala.';
            }
            if (currentSelectedOverride) {
                overridesDb[ovKey] = currentSelectedOverride;
                if (
                    currentSelectedOverride === 'HE50' ||
                    currentSelectedOverride === 'HE75' ||
                    currentSelectedOverride === 'HE110' ||
                    currentSelectedOverride === 'FA' ||
                    currentSelectedOverride === 'EA' ||
                    currentSelectedOverride === 'SA'
                ) {
                    const who = getSelectionWhoInfo(modalOverrideWho, currentTurma);
                    overrideMetaDb[ovKey] = { whoType: who.whoType, whoName: who.whoName };
                } else if (currentSelectedOverride === 'TD') {
                    const who = getSelectionWhoInfo(modalOverrideWho, currentTurma);
                    overrideMetaDb[ovKey] = {
                        whoType: who.whoType,
                        whoName: who.whoName,
                        swapWith: String(modalSwapWith || '').trim().slice(0, 40),
                        swapWithTeam: String(modalSwapWithTeam || '').trim().slice(0, 2)
                    };
                } else {
                    delete overrideMetaDb[ovKey];
                }
            } else {
                delete overridesDb[ovKey];
                delete overrideMetaDb[ovKey];
            }
        }

        const ok = DB.flushAll();
        closeModal();
        renderApp(false);
        updateStorageHealthUI();
        showToast(ok ? toastMsg : 'Aviso: salvamento bloqueado! Use o Backup.');
    };

    window.deleteNote = function () {
        const noteEl = document.getElementById('note-text');
        if (noteEl) noteEl.value = '';
        currentSelectedOverride = '';
        modalSwapWith = '';
        modalSwapWithTeam = '';
        setAtestadoUI(false);
        saveNote(true);
    };

    /* ------------------------------------------------------------------------
       6. CARD EXPLÍCITO DE OBSERVAÇÕES DO MÊS (UNIFICADO COM ATESTADOS)
       ------------------------------------------------------------------------ */
    function renderMonthObservationsCard(year, month, daysInMonth, holidays, monthAtestados) {
        const sec = ensureObservationsCardDOM();
        if (!sec) return false;

        const titleEl = document.getElementById('observations-summary-title');
        const badgeEl = document.getElementById('observations-summary-badge');
        const contEl = document.getElementById('observations-summary-container');
        if (!contEl) return false;

        const mmStr = String(month + 1).padStart(2, '0');
        const teamLtr = TEAM_LETTERS[currentTurma];
        if (titleEl) titleEl.innerText = `Ocorrências do Mês • Turno ${teamLtr}`;

        const items = [];
        const coveredAtestadoDates = new Set();

        /* 1. Atestados do mês (incluindo retorno de atestado iniciado no mês anterior) */
        monthAtestados.forEach(({ rec, whoInfo, retInfo }) => {
            const dates = getAtestadoDates(rec);
            dates.forEach(d => coveredAtestadoDates.add(d));
            const dtStart = parseDateKey(rec.startDate);
            const retCfg = SHIFTS_CONFIG[retInfo.returnShiftCode] || SHIFTS_CONFIG.M;
            const periodLabel = rec.days === 1
                ? `${formatShortDate(rec.startDate)} (1 dia)`
                : `${formatShortDate(rec.startDate)} a ${formatShortDate(retInfo.endDate)} (${rec.days} dias)`;
            const returnStr = `${formatReturnDateLabel(retInfo.returnDateKey)} • ${retCfg.name}${retCfg.hours ? ` (${retCfg.hours})` : ''}`;
            const skipMsg = retInfo.skippedFolgas > 0
                ? `<span class="block text-[10px] font-semibold text-sky-700/80 dark:text-sky-300/80 mt-0.5">Pulando ${retInfo.skippedFolgas} folga(s) normal(is).</span>`
                : '';
            const reason = getAtestadoReason(rec);

            items.push({
                sortKey: rec.startDate,
                html: `<div class="rounded-2xl bg-rose-50/75 dark:bg-rose-950/25 border border-rose-200/90 dark:border-rose-900/50 p-3 shadow-sm">
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span class="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black uppercase">Atestado</span>
                            <span class="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-200 text-[10px] font-black">${escapeHTML(whoInfo.fullLabel)}</span>
                            <span class="text-xs font-black text-rose-800 dark:text-rose-300">Período: ${periodLabel}</span>
                        </div>
                        <button type="button" onclick="openModal('${rec.startDate}')" class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer">Editar &gt;</button>
                    </div>
                    <div class="rounded-xl bg-sky-50 dark:bg-sky-950/35 border border-sky-200/80 dark:border-sky-900/50 px-3 py-2 text-xs">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-black text-sky-600 dark:text-sky-400">↳ Retorno:</span>
                            <span class="font-bold text-slate-800 dark:text-slate-100">${escapeHTML(returnStr)}</span>
                        </div>
                        ${skipMsg}
                    </div>
                    ${reason ? `<div class="mt-2 rounded-xl bg-white/85 dark:bg-oled/70 border border-rose-200/70 dark:border-rose-900/40 px-3 py-2">
                        <span class="block text-[9px] font-black uppercase tracking-wider text-rose-600/80 dark:text-rose-400/80 leading-none mb-1">Motivo / Observação</span>
                        <p class="text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug break-words whitespace-pre-wrap">${escapeHTML(reason)}</p>
                    </div>` : ''}
                </div>`
            });
            void dtStart;
        });

        /* 2. Demais observações e ocorrências do mês (HE, Troca, Falta, Folga alterada, Nota) */
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${mmStr}-${String(day).padStart(2, '0')}`;
            if (coveredAtestadoDates.has(dateKey)) continue;

            const noteText = getNote(dateKey, currentTurma).trim();
            const ovShift = overridesDb[`${dateKey}_${currentTurma}`] || '';
            if (!noteText && !ovShift) continue;

            const dow = new Date(year, month, day, 12, 0, 0).getDay();
            const isRedDay = dow === 0 || Boolean(holidays[day]);
            const dateBadgeCls = isRedDay
                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/80 dark:border-red-900/50'
                : 'bg-slate-100 dark:bg-oled text-slate-800 dark:text-slate-100 border-slate-200 dark:border-surfaceBorder';

            const baseShift = getShift(year, month, day, currentTurma);
            const baseCfg = SHIFTS_CONFIG[baseShift] || SHIFTS_CONFIG.M;
            const ovMeta = getOverrideMeta(dateKey, currentTurma);

            let tagHTML = '';
            let cardBorder = 'border-slate-200/90 dark:border-surfaceBorder';

            if (ovShift === 'FA') {
                const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: currentTurma } : { turma: currentTurma, whoType: 'both' }, currentTurma);
                tagHTML = `<span class="px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 text-[10px] font-black">Falta • ${escapeHTML(who.fullLabel)}</span>`;
                cardBorder = 'border-red-200/90 dark:border-red-900/50';
            } else if (ovShift === 'HE50' || ovShift === 'HE75' || ovShift === 'HE110') {
                const meta = OVERRIDE_META[ovShift];
                const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: currentTurma } : { turma: currentTurma, whoType: 'both' }, currentTurma);
                tagHTML = `<span class="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-black">${meta.label} • ${escapeHTML(who.fullLabel)}</span>`;
                cardBorder = 'border-amber-200/90 dark:border-amber-900/50';
            } else if (ovShift === 'EA') {
                const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: currentTurma } : { turma: currentTurma, whoType: 'both' }, currentTurma);
                tagHTML = `<span class="px-2 py-0.5 rounded-lg bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300 text-[10px] font-black">Entrada Atrasada • ${escapeHTML(who.fullLabel)}</span>`;
                cardBorder = 'border-cyan-200/90 dark:border-cyan-900/50';
            } else if (ovShift === 'SA') {
                const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: currentTurma } : { turma: currentTurma, whoType: 'both' }, currentTurma);
                tagHTML = `<span class="px-2 py-0.5 rounded-lg bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 text-[10px] font-black">Saída Adiantada • ${escapeHTML(who.fullLabel)}</span>`;
                cardBorder = 'border-teal-200/90 dark:border-teal-900/50';
            } else if (ovShift === 'TD') {
                const swap = formatSwapDisplay(ovMeta, currentTurma);
                tagHTML = `<span class="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 text-[10px] font-black">Troca: ${escapeHTML(swap.fullLabel)}</span>`;
                cardBorder = 'border-purple-200/90 dark:border-purple-900/50';
            } else if (ovShift === 'F') {
                tagHTML = `<span class="px-2 py-0.5 rounded-lg bg-green-100 dark:bg-green-950/70 text-green-800 dark:text-green-300 text-[10px] font-black">Folga${baseShift !== 'F' ? ` (era ${baseCfg.name})` : ''}</span>`;
                cardBorder = 'border-green-200/90 dark:border-green-900/50';
            } else if (ovShift === 'M' || ovShift === 'T' || ovShift === 'N') {
                const ovCfg = SHIFTS_CONFIG[ovShift] || baseCfg;
                tagHTML = `<span class="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-black">Hora Extra • ${escapeHTML(ovCfg.name)}</span>`;
                cardBorder = 'border-amber-200/90 dark:border-amber-900/50';
            } else {
                tagHTML = `<span class="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-black">Escala: ${escapeHTML(baseCfg.name)}</span>`;
            }

            const noteBodyHTML = noteText
                ? `<p class="mt-2 text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug break-words whitespace-pre-wrap">${escapeHTML(noteText)}</p>`
                : '';

            items.push({
                sortKey: dateKey,
                html: `<div class="rounded-2xl bg-white dark:bg-oled/85 border ${cardBorder} p-3 shadow-sm">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span class="px-2 py-0.5 rounded-lg border text-[11px] font-black tabular-nums ${dateBadgeCls}">${String(day).padStart(2, '0')}/${mmStr} • ${DOW_PRETTY[dow]}</span>
                            ${tagHTML}
                        </div>
                        <button type="button" onclick="openModal('${dateKey}')" class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer">Editar &gt;</button>
                    </div>
                    ${noteBodyHTML}
                </div>`
            });
        }

        items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        if (!items.length) {
            contEl.innerHTML = '';
            sec.classList.add('hidden');
            return false;
        }

        if (badgeEl) {
            badgeEl.innerText = `${items.length} ${items.length === 1 ? 'registro' : 'registros'}`;
        }
        contEl.innerHTML = items.map(it => it.html).join('');
        sec.classList.remove('hidden');
        return true;
    }

    /* Layout inteligente do rodapé: Observações do Mês + Feriados (sem duplicação de Atestado) */
    window.syncBottomCardsLayout = function (hasObs, hasHolidays) {
        const legacyAt = document.getElementById('atestado-summary-section');
        const obsSec = document.getElementById('observations-summary-section');
        const obsCont = document.getElementById('observations-summary-container');
        const hEl = document.getElementById('holidays-list');
        const grid = document.getElementById('bottom-cards-grid');
        if (!grid) return;

        if (legacyAt) legacyAt.classList.add('hidden');

        if (obsSec) {
            const fullWidthObs = Boolean(hasObs && !hasHolidays);
            obsSec.classList.toggle('lg:col-span-2', fullWidthObs);
            if (obsCont) {
                obsCont.className = fullWidthObs
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-2.5'
                    : 'space-y-2.5';
            }
        }
        if (hEl) {
            hEl.classList.toggle('lg:col-span-2', Boolean(hasHolidays && !hasObs));
        }
        grid.classList.toggle('hidden', !hasObs && !hasHolidays);
    };

    /* ------------------------------------------------------------------------
       7. RENDERIZAÇÃO PRINCIPAL DA ESCALA GERAL
       ------------------------------------------------------------------------ */
    window.renderApp = function (shouldScrollToday = false, swapDirection = 0) {
        try {
            sanitizeAllData();
            const sc = document.getElementById('table-scroll-wrap');
            const tableEl = document.getElementById('main-table');
            if (!tableEl) return;

            const prevScroll = sc ? sc.scrollLeft : 0;
            const year = currentDate.getFullYear(), month = currentDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate(), today = new Date();
            const isCMonth = today.getFullYear() === year && today.getMonth() === month;

            const monthDisp = document.getElementById('current-month-display');
            if (monthDisp) monthDisp.innerText = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            document.getElementById('btn-today')?.classList.toggle('hidden', isCMonth);

            document.querySelectorAll('.team-btn').forEach((btn, i) => {
                const act = i === currentTurma;
                btn.className = `team-btn p-2 lg:py-2.5 rounded-xl border flex flex-col items-center justify-center btn-smooth active:scale-95 min-w-0 cursor-pointer lg:min-h-[64px] ${act ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-800 dark:border-slate-700 dark:text-white shadow-md' : 'border-slate-200 dark:border-surfaceBorder bg-slate-50 hover:bg-slate-100 dark:bg-surface dark:hover:bg-zinc-900 text-slate-800 dark:text-slate-100'}`;
                const descEl = document.getElementById(`team-desc-${i}`);
                if (descEl) descEl.innerText = teamNames[i];
            });

            const returnDateMap = {}, atestadoDayMap = {}, monthAtestados = [];
            const otherTeamAtSet = [new Set(), new Set(), new Set(), new Set()];
            const monthStartKey = formatDateKey(year, month, 1), monthEndKey = formatDateKey(year, month, daysInMonth);

            atestadosDb
                .slice()
                .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
                .forEach(rec => {
                    const dates = getAtestadoDates(rec);
                    if (rec.turma !== currentTurma) {
                        dates.forEach(d => otherTeamAtSet[rec.turma]?.add(d));
                        return;
                    }
                    const whoInfo = resolveWhoInfo(rec, currentTurma);
                    dates.forEach((d, idx) => {
                        atestadoDayMap[d] = { record: rec, whoInfo, dayIndex: idx + 1, totalDays: dates.length, endDate: dates[dates.length - 1] };
                    });
                    const retInfo = computeReturnInfo(rec.startDate, rec.days, currentTurma, rec.id);
                    returnDateMap[retInfo.returnDateKey] = { rec, whoInfo, retInfo };
                    if ((rec.startDate <= monthEndKey && retInfo.endDate >= monthStartKey) || (retInfo.returnDateKey >= monthStartKey && retInfo.returnDateKey <= monthEndKey)) {
                        monthAtestados.push({ rec, whoInfo, retInfo });
                    }
                });

            const holidays = getHolidays(year, month);
            const dayMeta = [];
            const hListParts = [];
            const counts = { M: 0, T: 0, N: 0, F: 0 };

            const headerCells = ['<th class="sticky-col bg-slate-100 dark:bg-surface p-2 md:px-4 md:py-2.5 border-r border-slate-200 dark:border-surfaceBorder min-w-[126px] max-w-[144px] md:min-w-[162px] md:max-w-[180px] text-left pl-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-xs font-black uppercase text-slate-600 dark:text-slate-300">Turnos</th>'];
            const mmStr = String(month + 1).padStart(2, '0');
            for (let day = 1; day <= daysInMonth; day++) {
                const isToday = isCMonth && day === today.getDate();
                const holi = holidays[day] || '';
                const dow = new Date(year, month, day, 12, 0, 0).getDay();
                const isSunday = dow === 0;
                const dateKey = `${year}-${mmStr}-${String(day).padStart(2, '0')}`;
                dayMeta.push({ day, dateKey, isToday, holi, dow });

                const dayColor = holi ? 'text-red-600 dark:text-red-400' : (isToday ? 'text-blue-600 dark:text-blue-400' : (isSunday ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'));
                if (holi) hListParts.push(`<div class="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-surfaceBorder last:border-0 last:pb-0"><span class="font-black text-red-500 dark:text-red-400 text-sm min-w-[22px] text-right tabular-nums">${day}</span><span class="text-slate-700 dark:text-slate-300 font-medium text-sm leading-tight">${escapeHTML(holi)}</span></div>`);
                const todayHeaderStyle = isToday ? 'bg-blue-100/75 dark:bg-blue-950/60 border-b-2 border-b-blue-500' : '';
                const holiTitle = holi ? ` title="${escapeHTML(`Dia ${day}/${mmStr} • Feriado: ${holi}`)}"` : '';
                headerCells.push(`<th ${isToday ? 'id="col-today"' : ''}${holiTitle} class="p-1.5 md:py-2 md:px-0.5 min-w-[44px] xl:min-w-[38px] border-r border-slate-200 dark:border-surfaceBorder last:border-r-0 ${todayHeaderStyle}"><div class="flex flex-col items-center"><span class="text-[13px] font-black leading-tight tabular-nums ${dayColor}">${day}</span><span class="text-[9px] font-bold ${isSunday || holi || isToday ? 'opacity-95' : 'opacity-60'} ${dayColor}">${DOW_NAMES[dow]}</span></div></th>`);
            }

            const bodyRows = [];
            TEAM_LETTERS.forEach((teamLtr, idx) => {
                const isSel = idx === currentTurma, rowBg = isSel ? 'bg-white dark:bg-oled' : 'bg-slate-50 dark:bg-surface';
                const safeName = escapeHTML(teamNames[idx]);
                const cells = [`<td data-action="team" data-team="${idx}" class="sticky-col p-2 pl-3 md:px-4 md:py-2.5 border-r border-slate-200 dark:border-surfaceBorder align-middle text-left max-w-[144px] md:max-w-[180px] ${rowBg} cursor-pointer shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] hover:bg-slate-100/70 dark:hover:bg-zinc-900/60 transition-colors"><div class="flex flex-col items-start justify-center min-w-0"><span class="font-black text-sm leading-tight ${isSel ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}">Turno ${teamLtr}</span><span class="text-[9px] md:text-[10px] font-semibold truncate w-full max-w-[116px] md:max-w-[148px] ${isSel ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}" title="${safeName}">${safeName}</span></div></td>`];

                for (let i = 0; i < dayMeta.length; i++) {
                    const { day, dateKey, isToday, holi } = dayMeta[i];
                    const baseShift = getShift(year, month, day, idx);
                    const baseCfg = SHIFTS_CONFIG[baseShift] || SHIFTS_CONFIG.M;

                    if (isSel) {
                        const ovShift = overridesDb[`${dateKey}_${idx}`] || '';
                        const ovMeta = getOverrideMeta(dateKey, idx);
                        const atInfo = atestadoDayMap[dateKey];
                        const retEntry = (!atInfo && returnDateMap[dateKey]) ? returnDateMap[dateKey] : null;
                        const dayNote = getNote(dateKey, idx);
                        const noteDot = dayNote ? '<span class="absolute top-1 right-1 w-1.5 h-1.5 bg-slate-900 dark:bg-white rounded-full"></span>' : '';

                        let code = baseShift;
                        let style = baseCfg.style;
                        let ring = '';
                        let sub = '';
                        let badgeDot = '';
                        const tipParts = [`Dia ${String(day).padStart(2, '0')}/${mmStr} • Turno ${teamLtr} (${teamNames[idx]})`];

                        if (atInfo) {
                            code = 'AT';
                            style = SHIFTS_CONFIG.AT.style;
                            sub = `<span class="text-[7px] font-black leading-none mt-0.5 truncate max-w-[40px] opacity-95">${escapeHTML(atInfo.whoInfo.shortLabel)}</span><span class="text-[7px] font-extrabold leading-none opacity-75 tabular-nums">${atInfo.dayIndex}/${atInfo.totalDays}</span>`;
                            tipParts.push(`Atestado Médico (${atInfo.dayIndex}/${atInfo.totalDays}) • ${atInfo.whoInfo.fullLabel}`);
                        } else if (ovShift === 'FA') {
                            const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                            code = 'FA';
                            style = SHIFTS_CONFIG.FA.style;
                            sub = `<span class="text-[7px] font-black leading-none mt-0.5 truncate max-w-[40px] opacity-95">${escapeHTML(who.shortLabel)}</span>`;
                            tipParts.push(`Falta • ${who.fullLabel} (Escala: ${baseCfg.name})`);
                        } else if (ovShift === 'F') {
                            code = 'F';
                            style = SHIFTS_CONFIG.F.style;
                            counts.F++;
                            if (baseShift !== 'F') {
                                ring = ' ring-2 ring-inset ring-emerald-500/80 dark:ring-emerald-400/70';
                                badgeDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>';
                            }
                            tipParts.push('Folga (Alterado)');
                        } else if (ovShift === 'HE50' || ovShift === 'HE75' || ovShift === 'HE110') {
                            const meta = OVERRIDE_META[ovShift];
                            const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                            if (counts[baseShift] !== undefined) counts[baseShift]++;
                            ring = ' ring-2 ring-inset ring-amber-400 dark:ring-amber-500';
                            badgeDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-amber-500 rounded-full"></span>';
                            sub = `<span class="text-[7px] font-black leading-none text-amber-700 dark:text-amber-300 mt-0.5 tabular-nums">${meta.code}</span><span class="text-[6.5px] font-extrabold leading-none opacity-85 truncate max-w-[40px]">${escapeHTML(who.shortLabel)}</span>`;
                            tipParts.push(`${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''} • ${meta.label} (${who.fullLabel})`);
                        } else if (ovShift === 'TD') {
                            const swap = formatSwapDisplay(ovMeta, idx);
                            if (counts[baseShift] !== undefined) counts[baseShift]++;
                            ring = ' ring-2 ring-inset ring-purple-500 dark:ring-purple-400';
                            badgeDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-purple-500 rounded-full"></span>';
                            sub = `<span class="text-[6.5px] font-black leading-none text-purple-700 dark:text-purple-300 mt-0.5 truncate max-w-[40px]">${escapeHTML(swap.compactLabel)}</span>`;
                            tipParts.push(`${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''} • Troca: ${swap.fullLabel}`);
                        } else if (ovShift === 'EA') {
                            const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                            if (counts[baseShift] !== undefined) counts[baseShift]++;
                            ring = ' ring-2 ring-inset ring-cyan-500 dark:ring-cyan-400';
                            badgeDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>';
                            sub = `<span class="text-[7px] font-black leading-none text-cyan-700 dark:text-cyan-300 mt-0.5">EA</span><span class="text-[6.5px] font-extrabold leading-none opacity-85 truncate max-w-[40px]">${escapeHTML(who.shortLabel)}</span>`;
                            tipParts.push(`${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''} • Entrada Atrasada (${who.fullLabel})`);
                        } else if (ovShift === 'SA') {
                            const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                            if (counts[baseShift] !== undefined) counts[baseShift]++;
                            ring = ' ring-2 ring-inset ring-teal-500 dark:ring-teal-400';
                            badgeDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-teal-500 rounded-full"></span>';
                            sub = `<span class="text-[7px] font-black leading-none text-teal-700 dark:text-teal-300 mt-0.5">SA</span><span class="text-[6.5px] font-extrabold leading-none opacity-85 truncate max-w-[40px]">${escapeHTML(who.shortLabel)}</span>`;
                            tipParts.push(`${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''} • Saída Adiantada (${who.fullLabel})`);
                        } else if (ovShift === 'M' || ovShift === 'T' || ovShift === 'N') {
                            const ovCfg = SHIFTS_CONFIG[ovShift] || baseCfg;
                            code = ovShift;
                            style = ovCfg.style;
                            if (counts[ovShift] !== undefined) counts[ovShift]++;
                            ring = ' ring-2 ring-inset ring-amber-400 dark:ring-amber-500';
                            badgeDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-amber-500 rounded-full"></span>';
                            tipParts.push(`${ovCfg.name} (${ovCfg.hours}) • Hora Extra`);
                        } else {
                            if (counts[baseShift] !== undefined) counts[baseShift]++;
                            tipParts.push(`${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''}`);
                        }

                        if (retEntry) {
                            if (!ring) ring = ' ring-2 ring-inset ring-sky-500 dark:ring-sky-400';
                            if (!sub) sub = '<span class="text-[7px] font-black uppercase tracking-tight text-sky-700 dark:text-sky-300 leading-none mt-0.5">Volta</span>';
                            tipParts.push(`Dia de retorno ao trabalho (${retEntry.whoInfo.fullLabel})`);
                        }
                        if (holi) tipParts.push(`Feriado: ${holi}`);
                        if (dayNote) tipParts.push(`Obs: ${dayNote}`);

                        cells.push(`<td data-action="note" data-date="${dateKey}" data-day="${day}" title="${escapeHTML(tipParts.join('\n'))}" class="p-0.5 border-r border-slate-200 dark:border-surfaceBorder last:border-r-0 relative text-center text-sm ${style}${ring} cursor-pointer cell-smooth cell-active active:scale-95"><div class="w-full h-full flex flex-col items-center justify-center min-h-[46px] md:min-h-[52px] px-0.5"><span class="leading-none">${code}</span>${sub}${badgeDot}${noteDot}</div></td>`);
                    } else {
                        const ovOther = overridesDb[`${dateKey}_${idx}`] || '';
                        const ovOtherMeta = getOverrideMeta(dateKey, idx);
                        const hasOtherAt = otherTeamAtSet[idx]?.has(dateKey);
                        const dim = baseShift === 'F' ? 'text-green-600/65 dark:text-green-400/60 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium opacity-55';
                        let otherDot = '';
                        let extraTip = '';
                        if (hasOtherAt) {
                            otherDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-rose-500/80 rounded-full"></span>';
                            extraTip = ' • Atestado';
                        } else if (ovOther === 'FA') {
                            otherDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-red-600/80 rounded-full"></span>';
                            extraTip = ' • Falta';
                        } else if (ovOther === 'TD') {
                            const swap = formatSwapDisplay(ovOtherMeta, idx);
                            otherDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-purple-500/80 rounded-full"></span>';
                            extraTip = ` • Troca: ${swap.fullLabel}`;
                        } else if (ovOther === 'HE50' || ovOther === 'HE75' || ovOther === 'HE110') {
                            otherDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-amber-500/80 rounded-full"></span>';
                            extraTip = ` • ${OVERRIDE_META[ovOther].label}`;
                        } else if (ovOther === 'EA') {
                            otherDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-cyan-500/80 rounded-full"></span>';
                            extraTip = ' • Entrada Atrasada';
                        } else if (ovOther === 'SA') {
                            otherDot = '<span class="absolute top-1 left-1 w-1.5 h-1.5 bg-teal-500/80 rounded-full"></span>';
                            extraTip = ' • Saída Adiantada';
                        }
                        const tip = `Dia ${String(day).padStart(2, '0')}/${mmStr} • Turno ${teamLtr} (${teamNames[idx]}) • ${baseCfg.name}${baseCfg.hours ? ` (${baseCfg.hours})` : ''}${extraTip} • Clique para destacar`;
                        cells.push(`<td data-action="team" data-team="${idx}" title="${escapeHTML(tip)}" class="p-0.5 border-r border-slate-200 dark:border-surfaceBorder last:border-r-0 relative text-center text-sm cursor-pointer cell-smooth hover:opacity-90 ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20 ' : ''}${dim}"><div class="w-full h-full flex items-center justify-center min-h-[46px] md:min-h-[52px]">${baseShift}${otherDot}</div></td>`);
                    }
                }
                bodyRows.push(`<tr class="${rowBg} border-b border-slate-200 dark:border-surfaceBorder last:border-b-0">${cells.join('')}</tr>`);
            });

            tableEl.innerHTML = `<thead><tr class="bg-slate-100 dark:bg-surfaceBorder/40 border-b border-slate-200 dark:border-surfaceBorder">${headerCells.join('')}</tr></thead><tbody>${bodyRows.join('')}</tbody>`;
            if (swapDirection) animateTableSwap(tableEl, swapDirection);

            ['M', 'T', 'N', 'F'].forEach(k => updateCountAnimated(k, counts[k]));

            const hasObs = renderMonthObservationsCard(year, month, daysInMonth, holidays, monthAtestados);

            const hEl = document.getElementById('holidays-list');
            const hCont = document.getElementById('holidays-container');
            const hasHolidays = hListParts.length > 0;
            if (hEl && hCont) {
                if (hasHolidays) { hCont.innerHTML = hListParts.join(''); hEl.classList.remove('hidden'); }
                else { hEl.classList.add('hidden'); }
            }

            syncBottomCardsLayout(hasObs, hasHolidays);
            if (shouldScrollToday && isCMonth) scrollToTodayColumn();
            else if (sc) sc.scrollLeft = prevScroll;
            requestAnimationFrame(updateTableScrollHint);
        } catch (err) {
            console.error('Erro ao renderizar:', err);
            showToast('Erro ao carregar a visualização.');
        }
    };

    /* ------------------------------------------------------------------------
       8. QUADRO A4 HORIZONTAL (OPERADORES)
       ------------------------------------------------------------------------ */
    window.buildA4Dataset = function (includeChanges) {
        const year = currentDate.getFullYear(), month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let hasAnyOv = false, hasAnyTd = false, hasAnyAt = false, hasAnyFa = false, hasAnyEa = false, hasAnySa = false;
        const teams = TEAM_LETTERS.map((letter, idx) => {
            const counts = { M: 0, T: 0, N: 0, F: 0, AT: 0, FA: 0 };
            const atMap = {};
            if (includeChanges) {
                atestadosDb.filter(r => r.turma === idx).forEach(rec => {
                    const whoInfo = resolveWhoInfo(rec, idx);
                    const dates = getAtestadoDates(rec);
                    dates.forEach((d, pos) => {
                        atMap[d] = { dayIndex: pos + 1, totalDays: dates.length, whoShort: whoInfo.shortLabel };
                    });
                });
            }
            const cells = days.map(({ day, dateKey }) => {
                const base = getShift(year, month, day, idx);
                if (includeChanges) {
                    const atInfo = atMap[dateKey];
                    if (atInfo) {
                        counts.AT++;
                        hasAnyAt = true;
                        return { code: 'AT', sub: `${atInfo.dayIndex}/${atInfo.totalDays}`, whoShort: atInfo.whoShort, isOv: false, isTd: false, isEa: false, isSa: false };
                    }
                    const ov = overridesDb[`${dateKey}_${idx}`];
                    const ovMeta = getOverrideMeta(dateKey, idx);
                    if (ov === 'FA') {
                        const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                        counts.FA++;
                        hasAnyFa = true;
                        return { code: 'FA', sub: '', whoShort: who.shortLabel, isOv: false, isTd: false, isEa: false, isSa: false };
                    }
                    if (ov === 'F') {
                        counts.F++;
                        return { code: 'F', sub: '', whoShort: '', isOv: false, isTd: false, isEa: false, isSa: false };
                    }
                    if (ov === 'HE50' || ov === 'HE75' || ov === 'HE110') {
                        const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                        counts[base]++;
                        hasAnyOv = true;
                        return { code: base, sub: OVERRIDE_META[ov].code, whoShort: who.shortLabel, isOv: true, isTd: false, isEa: false, isSa: false };
                    }
                    if (ov === 'TD') {
                        const swap = formatSwapDisplay(ovMeta, idx);
                        counts[base]++;
                        hasAnyTd = true;
                        return { code: base, sub: swap.compactLabel, whoShort: '', isOv: false, isTd: true, isEa: false, isSa: false };
                    }
                    if (ov === 'EA') {
                        const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                        counts[base]++;
                        hasAnyEa = true;
                        return { code: base, sub: 'EA', whoShort: who.shortLabel, isOv: false, isTd: false, isEa: true, isSa: false };
                    }
                    if (ov === 'SA') {
                        const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                        counts[base]++;
                        hasAnySa = true;
                        return { code: base, sub: 'SA', whoShort: who.shortLabel, isOv: false, isTd: false, isEa: false, isSa: true };
                    }
                    if (ov === 'M' || ov === 'T' || ov === 'N') {
                        counts[ov]++;
                        hasAnyOv = true;
                        return { code: ov, sub: 'EX', whoShort: '', isOv: true, isTd: false, isEa: false, isSa: false };
                    }
                }
                counts[base]++;
                return { code: base, sub: '', whoShort: '', isOv: false, isTd: false, isEa: false, isSa: false };
            });
            return { letter, idx, name: teamNames[idx], cells, counts };
        });

        const issued = new Date();
        const issuedStr = `${String(issued.getDate()).padStart(2, '0')}/${String(issued.getMonth() + 1).padStart(2, '0')}/${issued.getFullYear()} às ${String(issued.getHours()).padStart(2, '0')}:${String(issued.getMinutes()).padStart(2, '0')}`;
        return { year, month, mmStr, daysInMonth, monthLabel, days, holidaysList, teams, hasAnyOv, hasAnyTd, hasAnyAt, hasAnyFa, hasAnyEa, hasAnySa, issuedStr, includeChanges };
    };

    window.buildA4SheetHTML = function (data) {
        const headDaysHTML = data.days.map(d => {
            const cls = d.holiday ? ' is-holi' : (d.isSunday ? ' is-sun' : '');
            return `<th class="a4-th-day${cls}"><span class="a4-day-num">${String(d.day).padStart(2, '0')}</span><span class="a4-day-dow">${d.dowLabel}</span></th>`;
        }).join('');

        const rowsHTML = data.teams.map(t => {
            const cellsHTML = t.cells.map(c => {
                const extraCls = c.isOv ? ' a4-cell-ov' : (c.isTd ? ' a4-cell-td' : (c.isEa ? ' a4-cell-ea' : (c.isSa ? ' a4-cell-sa' : '')));
                const subHTML = c.sub ? `<span class="a4-cell-sub">${escapeHTML(c.sub)}</span>` : '';
                const whoHTML = c.whoShort ? `<span class="a4-cell-who">${escapeHTML(c.whoShort)}</span>` : '';
                return `<td class="a4-cell a4-cell-${c.code}${extraCls}"><span>${c.code}</span>${whoHTML}${subHTML}</td>`;
            }).join('');
            return `<tr><td class="a4-td-team"><div class="a4-team-title"><span class="a4-team-badge">${t.letter}</span><span>Turno ${t.letter}</span></div><span class="a4-team-names">${escapeHTML(t.name)}</span></td>${cellsHTML}</tr>`;
        }).join('');

        const summaryRowsHTML = data.teams.map(t => {
            const atCell = data.hasAnyAt ? `<td style="color:#be123c">${t.counts.AT}</td>` : '';
            const faCell = data.hasAnyFa ? `<td style="color:#b91c1c">${t.counts.FA}</td>` : '';
            return `<tr><td><strong>Turno ${t.letter}</strong><span class="a4-sum-sub">${escapeHTML(t.name)}</span></td><td style="color:#1e40af">${t.counts.M}</td><td style="color:#9a3412">${t.counts.T}</td><td style="color:#3730a3">${t.counts.N}</td><td style="color:#15803d">${t.counts.F}</td>${atCell}${faCell}</tr>`;
        }).join('');

        const holidaysHTML = data.holidaysList.length
            ? `<div class="a4-holi-list">${data.holidaysList.map(h => `<div class="a4-holi-row"><span class="a4-holi-date">${h.dateStr} (${h.dowPretty})</span><span class="a4-holi-name">${escapeHTML(h.name)}</span></div>`).join('')}</div>`
            : `<div class="a4-holi-empty">Nenhum feriado nacional, estadual ou municipal neste mês.</div>`;

        const extraLegendItems = ['<span><strong style="color:#dc2626">■</strong> Domingos / Feriados</span>'];
        if (data.hasAnyOv) extraLegendItems.push('<span><strong style="color:#d97706">□</strong> Hora Extra</span>');
        if (data.hasAnyTd) extraLegendItems.push('<span><strong style="color:#7c3aed">□</strong> Troca</span>');
        if (data.hasAnyEa) extraLegendItems.push('<span><strong style="color:#0891b2">EA</strong> Ent. Atrasada</span>');
        if (data.hasAnySa) extraLegendItems.push('<span><strong style="color:#0d9488">SA</strong> Saída Adiant.</span>');
        if (data.hasAnyAt) extraLegendItems.push('<span><strong style="color:#be123c">AT</strong> Atestado</span>');
        if (data.hasAnyFa) extraLegendItems.push('<span><strong style="color:#b91c1c">FA</strong> Falta</span>');

        return `<div class="a4-sheet">
            <div class="a4-header">
                <div class="a4-brand">
                    <img class="a4-logo" src="${IMERYS_SVG_URI}" alt="Imerys">
                    <div>
                        <h2 class="a4-title">ESCALA GERAL DE REVEZAMENTO 3×1</h2>
                        <div class="a4-subtitle">IMERYS • BRITAGEM ICP 1 • QUADRO DE AVISOS DOS TURNOS</div>
                    </div>
                </div>
                <div class="a4-period-box">
                    <span class="a4-month-pill">${escapeHTML(data.monthLabel)}</span>
                    <span class="a4-cycle-note">Revezamento Contínuo • 4 Equipes (A, B, C e D) • ${data.daysInMonth} dias</span>
                </div>
            </div>

            <div class="a4-table-wrap">
                <table class="a4-table">
                    <thead><tr><th class="a4-th-team">Turnos / Equipes</th>${headDaysHTML}</tr></thead>
                    <tbody>${rowsHTML}</tbody>
                </table>
            </div>

            <div class="a4-bottom-grid">
                <div class="a4-card">
                    <div class="a4-card-title">Legenda dos Turnos</div>
                    <div class="a4-legend-list">
                        <div class="a4-legend-item"><div class="a4-legend-left"><span class="a4-legend-chip a4-cell-M">M</span><span class="a4-legend-name">Manhã</span></div><span class="a4-legend-hours">05:00 às 13:00</span></div>
                        <div class="a4-legend-item"><div class="a4-legend-left"><span class="a4-legend-chip a4-cell-T">T</span><span class="a4-legend-name">Tarde</span></div><span class="a4-legend-hours">13:00 às 21:00</span></div>
                        <div class="a4-legend-item"><div class="a4-legend-left"><span class="a4-legend-chip a4-cell-N">N</span><span class="a4-legend-name">Noite</span></div><span class="a4-legend-hours">21:00 às 05:00</span></div>
                        <div class="a4-legend-item"><div class="a4-legend-left"><span class="a4-legend-chip a4-cell-F">F</span><span class="a4-legend-name">Folga</span></div><span class="a4-legend-hours">Descanso</span></div>
                    </div>
                    <div class="a4-legend-extra">${extraLegendItems.join('')}</div>
                </div>

                <div class="a4-card">
                    <div class="a4-card-title">Resumo Mensal por Turno</div>
                    <table class="a4-summary-table">
                        <thead><tr><th>Turno / Equipe</th><th>M</th><th>T</th><th>N</th><th>F</th>${data.hasAnyAt ? '<th>AT</th>' : ''}${data.hasAnyFa ? '<th>FA</th>' : ''}</tr></thead>
                        <tbody>${summaryRowsHTML}</tbody>
                    </table>
                </div>

                <div class="a4-card">
                    <div class="a4-card-title">Feriados do Mês (Nacional / ES / Cachoeiro)</div>
                    ${holidaysHTML}
                </div>
            </div>

            <div class="a4-footer">
                <span>Imerys • Britagem ICP 1 • Escala Oficial para Quadro dos Operadores</span>
                <span>Emitido em ${data.issuedStr} • Formato A4 Horizontal</span>
            </div>
        </div>`;
    };

    async function downloadQuadroA4PNG() {
        haptic();
        showToast('Gerando imagem A4 HD...');
        const data = buildA4Dataset(a4IncludeChanges);
        const W = 2338, H = 1654;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const font = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        const padX = 58, padTop = 50, contentW = W - padX * 2;
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
        ctx.fillStyle = '#0f172a'; ctx.font = `900 48px ${font}`;
        ctx.fillText('ESCALA GERAL DE REVEZAMENTO 3×1', padX + logoSize + 28, padTop + 12);
        ctx.fillStyle = '#475569'; ctx.font = `800 22px ${font}`;
        ctx.fillText('IMERYS • BRITAGEM ICP 1 • QUADRO DE AVISOS DOS TURNOS', padX + logoSize + 28, padTop + 74);

        ctx.font = `900 40px ${font}`;
        const pillW = Math.max(360, ctx.measureText(data.monthLabel).width + 76), pillH = 68;
        const pillX = W - padX - pillW, pillY = padTop + 4;
        canvasRoundRect(ctx, pillX, pillY, pillW, pillH, 18);
        ctx.fillStyle = '#0f172a'; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(data.monthLabel, pillX + pillW / 2, pillY + pillH / 2 + 1);

        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#475569'; ctx.font = `700 21px ${font}`;
        ctx.fillText(`Revezamento Contínuo • 4 Equipes (A, B, C e D) • ${data.daysInMonth} dias`, W - padX, pillY + pillH + 14);

        const headerBottomY = padTop + logoSize + 24;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(padX, headerBottomY, contentW, 5);

        const tblX = padX, tblY = headerBottomY + 26;
        const teamColW = 330;
        const dayColW = (contentW - teamColW) / data.daysInMonth;
        const headRowH = 92, teamRowH = 142;
        const tblH = headRowH + teamRowH * 4;

        ctx.save();
        canvasRoundRect(ctx, tblX, tblY, contentW, tblH, 18);
        ctx.clip();

        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(tblX, tblY, teamColW, headRowH);
        ctx.fillStyle = '#0f172a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = `900 22px ${font}`;
        ctx.fillText('TURNOS / EQUIPES', tblX + 22, tblY + headRowH / 2);

        data.days.forEach((d, i) => {
            const x = tblX + teamColW + i * dayColW;
            ctx.fillStyle = d.holiday ? '#fee2e2' : (d.isSunday ? '#fef2f2' : '#f8fafc');
            ctx.fillRect(x, tblY, dayColW, headRowH);
            if (d.holiday) { ctx.fillStyle = '#dc2626'; ctx.fillRect(x, tblY, dayColW, 7); }
            const txtColor = d.holiday ? '#b91c1c' : (d.isSunday ? '#dc2626' : '#0f172a');
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = txtColor; ctx.font = `900 27px ${font}`;
            ctx.fillText(String(d.day).padStart(2, '0'), x + dayColW / 2, tblY + 34);
            ctx.fillStyle = (d.holiday || d.isSunday) ? txtColor : '#64748b'; ctx.font = `800 16px ${font}`;
            ctx.fillText(d.dowLabel, x + dayColW / 2, tblY + 67);
        });

        data.teams.forEach((t, rowIdx) => {
            const y = tblY + headRowH + rowIdx * teamRowH;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(tblX, y, teamColW, teamRowH);

            canvasRoundRect(ctx, tblX + 22, y + 32, 42, 42, 11);
            ctx.fillStyle = '#0f172a'; ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `900 23px ${font}`;
            ctx.fillText(t.letter, tblX + 43, y + 54);

            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0f172a'; ctx.font = `900 30px ${font}`;
            ctx.fillText(`Turno ${t.letter}`, tblX + 76, y + 54);
            ctx.fillStyle = '#475569'; ctx.font = `700 21px ${font}`;
            ctx.fillText(canvasTruncateText(ctx, t.name, teamColW - 44), tblX + 22, y + 102);

            t.cells.forEach((cell, cIdx) => {
                const x = tblX + teamColW + cIdx * dayColW;
                const p = PALETTE[cell.code] || PALETTE.F;
                ctx.fillStyle = p.bg;
                ctx.fillRect(x, y, dayColW, teamRowH);

                if (cell.code === 'AT') {
                    ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 4;
                    ctx.strokeRect(x + 2, y + 2, dayColW - 4, teamRowH - 4);
                } else if (cell.code === 'FA') {
                    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 4;
                    ctx.strokeRect(x + 2, y + 2, dayColW - 4, teamRowH - 4);
                } else if (cell.isOv) {
                    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 5;
                    ctx.strokeRect(x + 2.5, y + 2.5, dayColW - 5, teamRowH - 5);
                } else if (cell.isTd) {
                    ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 5;
                    ctx.strokeRect(x + 2.5, y + 2.5, dayColW - 5, teamRowH - 5);
                } else if (cell.isEa) {
                    ctx.strokeStyle = '#0891b2'; ctx.lineWidth = 5;
                    ctx.strokeRect(x + 2.5, y + 2.5, dayColW - 5, teamRowH - 5);
                } else if (cell.isSa) {
                    ctx.strokeStyle = '#0d9488'; ctx.lineWidth = 5;
                    ctx.strokeRect(x + 2.5, y + 2.5, dayColW - 5, teamRowH - 5);
                }

                ctx.fillStyle = p.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                if (cell.whoShort && cell.sub) {
                    ctx.font = `900 27px ${font}`;
                    ctx.fillText(cell.code, x + dayColW / 2, y + teamRowH / 2 - 26);
                    ctx.font = `800 13px ${font}`;
                    ctx.fillText(canvasTruncateText(ctx, cell.whoShort, dayColW - 8), x + dayColW / 2, y + teamRowH / 2 + 6);
                    ctx.font = `900 14px ${font}`;
                    ctx.fillText(cell.sub, x + dayColW / 2, y + teamRowH / 2 + 32);
                } else if (cell.whoShort || cell.sub) {
                    const bottomTxt = cell.whoShort || cell.sub;
                    ctx.font = `900 30px ${font}`;
                    ctx.fillText(cell.code, x + dayColW / 2, y + teamRowH / 2 - 14);
                    ctx.font = `800 13px ${font}`;
                    ctx.fillText(canvasTruncateText(ctx, bottomTxt, dayColW - 8), x + dayColW / 2, y + teamRowH / 2 + 24);
                } else {
                    ctx.font = `900 31px ${font}`;
                    ctx.fillText(cell.code, x + dayColW / 2, y + teamRowH / 2);
                }
            });
        });

        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
        for (let i = 1; i < data.daysInMonth; i++) {
            const x = tblX + teamColW + i * dayColW;
            ctx.beginPath(); ctx.moveTo(x, tblY); ctx.lineTo(x, tblY + tblH); ctx.stroke();
        }
        for (let r = 1; r < 4; r++) {
            const y = tblY + headRowH + r * teamRowH;
            ctx.beginPath(); ctx.moveTo(tblX, y); ctx.lineTo(tblX + contentW, y); ctx.stroke();
        }
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(tblX + teamColW, tblY); ctx.lineTo(tblX + teamColW, tblY + tblH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tblX, tblY + headRowH); ctx.lineTo(tblX + contentW, tblY + headRowH); ctx.stroke();
        ctx.restore();

        canvasRoundRect(ctx, tblX, tblY, contentW, tblH, 18);
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 3.5; ctx.stroke();

        const cardsY = tblY + tblH + 30;
        const footerH = 54;
        const cardsH = H - cardsY - footerH - 36;
        const gap = 28;
        const w1 = Math.round((contentW - gap * 2) * 0.305);
        const w2 = Math.round((contentW - gap * 2) * 0.375);
        const w3 = contentW - gap * 2 - w1 - w2;
        const x1 = padX, x2 = x1 + w1 + gap, x3 = x2 + w2 + gap;

        const drawCardBox = (x, w, title) => {
            canvasRoundRect(ctx, x, cardsY, w, cardsH, 18);
            ctx.fillStyle = '#f8fafc'; ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#334155'; ctx.font = `900 20px ${font}`;
            ctx.fillText(title, x + 26, cardsY + 22);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(x + 26, cardsY + 56, w - 52, 2);
        };

        drawCardBox(x1, w1, 'LEGENDA DOS TURNOS');
        [
            { code: 'M', name: 'Manhã', hrs: '05:00 às 13:00' },
            { code: 'T', name: 'Tarde', hrs: '13:00 às 21:00' },
            { code: 'N', name: 'Noite', hrs: '21:00 às 05:00' },
            { code: 'F', name: 'Folga', hrs: 'Descanso' }
        ].forEach((lr, idx) => {
            const ry = cardsY + 74 + idx * 80;
            const p = PALETTE[lr.code];
            canvasRoundRect(ctx, x1 + 26, ry, w1 - 52, 66, 13);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.stroke();
            canvasRoundRect(ctx, x1 + 40, ry + 11, 48, 44, 10);
            ctx.fillStyle = p.bg; ctx.fill();
            ctx.fillStyle = p.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `900 23px ${font}`;
            ctx.fillText(lr.code, x1 + 64, ry + 34);
            ctx.textAlign = 'left'; ctx.fillStyle = '#0f172a'; ctx.font = `800 24px ${font}`;
            ctx.fillText(lr.name, x1 + 104, ry + 34);
            ctx.textAlign = 'right'; ctx.fillStyle = '#334155'; ctx.font = `800 22px ${font}`;
            ctx.fillText(lr.hrs, x1 + w1 - 44, ry + 34);
        });
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#dc2626'; ctx.font = `800 17px ${font}`;
        let extraFooter = '■ Domingos/Feriados';
        if (data.hasAnyOv) extraFooter += '  □ Extra';
        if (data.hasAnyTd) extraFooter += '  □ Troca';
        if (data.hasAnyEa) extraFooter += '  EA: Atraso';
        if (data.hasAnySa) extraFooter += '  SA: Saída';
        if (data.hasAnyAt) extraFooter += '  AT: Atest.';
        if (data.hasAnyFa) extraFooter += '  FA: Falta';
        ctx.fillText(canvasTruncateText(ctx, extraFooter, w1 - 52), x1 + 26, cardsY + cardsH - 18);

        drawCardBox(x2, w2, 'RESUMO MENSAL POR TURNO');
        const stX = x2 + 26, stY = cardsY + 74, stW = w2 - 52, stH = cardsH - 96;
        const stHeadH = 54, stRowH = (stH - stHeadH) / 4;
        const sumHeaders = ['M', 'T', 'N', 'F'];
        if (data.hasAnyAt) sumHeaders.push('AT');
        if (data.hasAnyFa) sumHeaders.push('FA');
        const numColW = sumHeaders.length > 5 ? 64 : 74;
        const nameColW = stW - sumHeaders.length * numColW;

        ctx.save();
        canvasRoundRect(ctx, stX, stY, stW, stH, 13);
        ctx.clip();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(stX, stY, stW, stHeadH);
        ctx.fillStyle = '#334155'; ctx.font = `900 19px ${font}`; ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText('TURNO / EQUIPE', stX + 18, stY + stHeadH / 2);
        ctx.textAlign = 'center';
        sumHeaders.forEach((sh, si) => ctx.fillText(sh, stX + nameColW + si * numColW + numColW / 2, stY + stHeadH / 2));

        data.teams.forEach((t, ti) => {
            const ry = stY + stHeadH + ti * stRowH;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(stX, ry, stW, stRowH);
            if (ti > 0) { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(stX, ry, stW, 2); }
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0f172a'; ctx.font = `900 23px ${font}`;
            ctx.fillText(`Turno ${t.letter}`, stX + 18, ry + stRowH * 0.34);
            ctx.fillStyle = '#64748b'; ctx.font = `600 18px ${font}`;
            ctx.fillText(canvasTruncateText(ctx, t.name, nameColW - 26), stX + 18, ry + stRowH * 0.72);

            const vals = [
                { v: t.counts.M, c: '#1e40af' },
                { v: t.counts.T, c: '#9a3412' },
                { v: t.counts.N, c: '#3730a3' },
                { v: t.counts.F, c: '#15803d' }
            ];
            if (data.hasAnyAt) vals.push({ v: t.counts.AT, c: '#be123c' });
            if (data.hasAnyFa) vals.push({ v: t.counts.FA, c: '#b91c1c' });
            ctx.textAlign = 'center'; ctx.font = `900 24px ${font}`;
            vals.forEach((item, vi) => {
                ctx.fillStyle = item.c;
                ctx.fillText(String(item.v), stX + nameColW + vi * numColW + numColW / 2, ry + stRowH / 2);
            });
        });
        ctx.restore();
        canvasRoundRect(ctx, stX, stY, stW, stH, 13);
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();

        drawCardBox(x3, w3, 'FERIADOS DO MÊS (NACIONAL / ES / CACHOEIRO)');
        if (data.holidaysList.length === 0) {
            canvasRoundRect(ctx, x3 + 26, cardsY + 130, w3 - 52, 120, 14);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.setLineDash([8, 6]); ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `700 22px ${font}`;
            ctx.fillText('Nenhum feriado previsto neste mês.', x3 + w3 / 2, cardsY + 190);
        } else {
            const maxShow = Math.min(data.holidaysList.length, 6);
            const rowStep = Math.min(68, Math.floor((cardsH - 96) / Math.max(1, maxShow)));
            const itemH = Math.max(46, rowStep - 10);
            for (let hi = 0; hi < maxShow; hi++) {
                const h = data.holidaysList[hi];
                const ry = cardsY + 74 + hi * rowStep;
                canvasRoundRect(ctx, x3 + 26, ry, w3 - 52, itemH, 10);
                ctx.fillStyle = '#ffffff'; ctx.fill();
                ctx.strokeStyle = '#fecaca'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#dc2626';
                ctx.fillRect(x3 + 26, ry + 3, 7, itemH - 6);
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#b91c1c'; ctx.font = `900 21px ${font}`;
                const dLbl = `${h.dateStr} (${h.dowPretty})`;
                ctx.fillText(dLbl, x3 + 46, ry + itemH / 2);
                const dW = ctx.measureText(dLbl).width;
                ctx.fillStyle = '#1e293b'; ctx.font = `700 21px ${font}`;
                ctx.fillText(canvasTruncateText(ctx, h.name, w3 - 106 - dW), x3 + 60 + dW, ry + itemH / 2);
            }
        }

        const footY = H - 54;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(padX, footY - 14, contentW, 2);
        ctx.textBaseline = 'top'; ctx.fillStyle = '#64748b'; ctx.font = `700 19px ${font}`;
        ctx.textAlign = 'left';
        ctx.fillText('Imerys • Britagem ICP 1 • Escala Oficial para Quadro dos Operadores', padX, footY);
        ctx.textAlign = 'right';
        ctx.fillText(`Emitido em ${data.issuedStr} • Formato A4 Horizontal (HD)`, W - padX, footY);

        triggerCanvasDownload(c, `Escala_Imerys_A4_${data.mmStr}_${data.year}.png`, 'Imagem A4 HD baixada com sucesso!');
    }

    /* ------------------------------------------------------------------------
       9. RELATÓRIO DE OCORRÊNCIAS MENSAIS (DADOS, HTML, PNG E TEXTO)
       ------------------------------------------------------------------------ */
    function buildSupervisorDataset(teamFilter, sortMode) {
        sanitizeAllData();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthLabel = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        const mmStr = String(month + 1).padStart(2, '0');
        const holidaysMap = getHolidays(year, month);
        const targetTeams = teamFilter === 'all' ? [0, 1, 2, 3] : [parseInt(teamFilter, 10)];

        const atByTeam = [{}, {}, {}, {}];
        for (let idx = 0; idx < 4; idx++) {
            atestadosDb.filter(r => r.turma === idx).forEach(rec => {
                const whoInfo = resolveWhoInfo(rec, idx);
                const retInfo = computeReturnInfo(rec.startDate, rec.days, idx, rec.id);
                const dates = getAtestadoDates(rec);
                dates.forEach((d, pos) => {
                    atByTeam[idx][d] = {
                        record: rec,
                        whoInfo,
                        retInfo,
                        dayIndex: pos + 1,
                        totalDays: dates.length
                    };
                });
            });
        }

        const entries = [];
        const perTeamAll = [0, 0, 0, 0];
        const uniqueDaysSet = new Set();
        const seenAtestadoIds = new Set();

        /* Contadores separados de cada categoria (somam exatamente o Total de Ocorrências) */
        const categoryCounts = {
            extras: 0,
            atestados: 0,
            faltas: 0,
            trocas: 0,
            atrasos: 0,
            saidas: 0,
            outras: 0
        };

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${mmStr}-${String(day).padStart(2, '0')}`;
            const dow = new Date(year, month, day, 12, 0, 0).getDay();
            const isSunday = dow === 0;
            const holiday = holidaysMap[day] || '';

            for (let idx = 0; idx < 4; idx++) {
                const rawNote = getNote(dateKey, idx).trim();
                const ovShift = overridesDb[`${dateKey}_${idx}`] || '';
                const ovMeta = getOverrideMeta(dateKey, idx);
                const atInfo = atByTeam[idx][dateKey] || null;

                let includeEntry = false;
                let displayNote = rawNote;

                if (atInfo) {
                    if (!seenAtestadoIds.has(atInfo.record.id)) {
                        seenAtestadoIds.add(atInfo.record.id);
                        includeEntry = true;
                        displayNote = getAtestadoReason(atInfo.record) || rawNote;
                    }
                } else if (rawNote || ovShift) {
                    includeEntry = true;
                }

                if (!includeEntry) continue;

                perTeamAll[idx]++;
                if (!targetTeams.includes(idx)) continue;

                const baseShift = getShift(year, month, day, idx);
                const baseCfg = SHIFTS_CONFIG[baseShift] || SHIFTS_CONFIG.M;
                const baseHoursText = baseCfg.hours ? ` (${baseCfg.hours})` : '';

                let chipCode = baseShift;
                let chipPaletteKey = baseShift;
                let shiftLabel = `Escala Normal — ${baseCfg.name}`;
                let shiftSub = baseCfg.hours || 'Descanso';

                if (atInfo) {
                    categoryCounts.atestados++;
                    chipCode = 'AT';
                    chipPaletteKey = 'AT';
                    const retCfg = SHIFTS_CONFIG[atInfo.retInfo.returnShiftCode] || SHIFTS_CONFIG.M;
                    shiftLabel = `Atestado Médico — ${atInfo.whoInfo.fullLabel} (${atInfo.totalDays} ${atInfo.totalDays === 1 ? 'dia' : 'dias'})`;
                    shiftSub = `Volta: ${formatShortDate(atInfo.retInfo.returnDateKey)} (${retCfg.name})`;
                } else if (ovShift === 'FA') {
                    categoryCounts.faltas++;
                    const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                    chipCode = 'FA';
                    chipPaletteKey = 'FA';
                    shiftLabel = `Falta — ${who.fullLabel}`;
                    shiftSub = `Escala: ${baseCfg.name}${baseHoursText}`;
                } else if (ovShift === 'HE50' || ovShift === 'HE75' || ovShift === 'HE110') {
                    categoryCounts.extras++;
                    const meta = OVERRIDE_META[ovShift];
                    const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                    chipCode = meta.chip;
                    chipPaletteKey = 'HE';
                    shiftLabel = `${meta.label} — ${who.fullLabel}`;
                    shiftSub = `Escala: ${baseCfg.name}${baseHoursText}`;
                } else if (ovShift === 'TD') {
                    categoryCounts.trocas++;
                    const swap = formatSwapDisplay(ovMeta, idx);
                    chipCode = 'TD';
                    chipPaletteKey = 'TD';
                    shiftLabel = `Troca de Dia — ${swap.fullLabel}`;
                    shiftSub = `Escala: ${baseCfg.name}${baseHoursText}`;
                } else if (ovShift === 'EA') {
                    categoryCounts.atrasos++;
                    const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                    chipCode = 'EA';
                    chipPaletteKey = 'EA';
                    shiftLabel = `Entrada Atrasada — ${who.fullLabel}`;
                    shiftSub = `Escala: ${baseCfg.name}${baseHoursText}`;
                } else if (ovShift === 'SA') {
                    categoryCounts.saidas++;
                    const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: idx } : { turma: idx, whoType: 'both' }, idx);
                    chipCode = 'SA';
                    chipPaletteKey = 'SA';
                    shiftLabel = `Saída Adiantada — ${who.fullLabel}`;
                    shiftSub = `Escala: ${baseCfg.name}${baseHoursText}`;
                } else if (ovShift === 'F') {
                    categoryCounts.outras++;
                    chipCode = 'F';
                    chipPaletteKey = 'F';
                    shiftLabel = baseShift !== 'F' ? `Folga (Alterado de ${baseCfg.name})` : 'Folga';
                    shiftSub = 'Descanso';
                } else if (ovShift === 'M' || ovShift === 'T' || ovShift === 'N') {
                    categoryCounts.extras++;
                    const ovCfg = SHIFTS_CONFIG[ovShift] || baseCfg;
                    chipCode = ovShift;
                    chipPaletteKey = 'HE';
                    shiftLabel = `Hora Extra — ${ovCfg.name}`;
                    shiftSub = ovCfg.hours;
                } else {
                    categoryCounts.outras++;
                }

                uniqueDaysSet.add(day);
                entries.push({
                    day,
                    dateKey,
                    dateStr: `${String(day).padStart(2, '0')}/${mmStr}`,
                    dowPretty: DOW_PRETTY[dow],
                    isSunday,
                    holiday,
                    turmaIdx: idx,
                    letter: TEAM_LETTERS[idx],
                    teamName: teamNames[idx],
                    chipCode,
                    chipPaletteKey,
                    shiftLabel,
                    shiftSub,
                    text: displayNote
                });
            }
        }

        if (sortMode === 'team') entries.sort((a, b) => (a.turmaIdx - b.turmaIdx) || (a.day - b.day));
        else entries.sort((a, b) => (a.day - b.day) || (a.turmaIdx - b.turmaIdx));

        const totalAllMonth = perTeamAll.reduce((acc, n) => acc + n, 0);
        const totalOcorrencias =
            categoryCounts.extras +
            categoryCounts.atestados +
            categoryCounts.faltas +
            categoryCounts.trocas +
            categoryCounts.atrasos +
            categoryCounts.saidas +
            categoryCounts.outras;

        const scopeLabel = teamFilter === 'all'
            ? 'Todos os Turnos (A, B, C e D)'
            : `Turno ${TEAM_LETTERS[targetTeams[0]]} (${teamNames[targetTeams[0]]})`;
        const sortLabel = sortMode === 'team'
            ? `Agrupado por Turno (A → D) • Dia 1 → ${daysInMonth}`
            : `Ordem Cronológica (Dia 1 → ${daysInMonth})`;

        const issued = new Date();
        const issuedStr = `${String(issued.getDate()).padStart(2, '0')}/${String(issued.getMonth() + 1).padStart(2, '0')}/${issued.getFullYear()} às ${String(issued.getHours()).padStart(2, '0')}:${String(issued.getMinutes()).padStart(2, '0')}`;

        return {
            year, month, mmStr, daysInMonth, monthLabel, teamFilter, sortMode,
            scopeLabel, sortLabel, entries,
            totalNotes: totalOcorrencias,
            totalAllMonth,
            uniqueDays: uniqueDaysSet.size,
            perTeam: perTeamAll,
            categoryCounts,
            issuedStr
        };
    }

    function buildSupervisorSheetHTML(data) {
        const c = data.categoryCounts;
        const summaryCards = [
            { label: 'Hora Extra',    val: c.extras,    accent: '#d97706' },
            { label: 'Atestados',     val: c.atestados, accent: '#e11d48' },
            { label: 'Faltas',        val: c.faltas,    accent: '#dc2626' },
            { label: 'Trocas',        val: c.trocas,    accent: '#7c3aed' },
            { label: 'Ent. Atrasada', val: c.atrasos,   accent: '#0891b2' },
            { label: 'Saída Adiant.', val: c.saidas,    accent: '#0d9488' },
            { label: 'Outras / Folgas', val: c.outras,  accent: '#64748b' }
        ];

        const kpiCardsHTML = summaryCards.map(card => `
            <div class="sup-kpi-card" style="border-top-color:${card.accent}">
                <span class="sup-kpi-label">${card.label}</span>
                <div class="sup-kpi-val">${card.val}</div>
            </div>
        `).join('') + `
            <div class="sup-kpi-card is-total">
                <span class="sup-kpi-label">Total de Ocorrências</span>
                <div class="sup-kpi-val">${data.totalNotes}</div>
                <span class="sup-kpi-sub">${data.teamFilter === 'all' ? 'Soma geral do mês' : `de ${data.totalAllMonth} no mês`}</span>
            </div>
        `;

        const teamMetaChips = TEAM_LETTERS.map((ltr, idx) => {
            const dimCls = (data.teamFilter !== 'all' && String(idx) !== String(data.teamFilter)) ? ' is-dim' : '';
            return `<span class="sup-meta-chip${dimCls}">Turno ${ltr}: ${data.perTeam[idx]}</span>`;
        }).join('');

        let tableBodyHTML = '';
        if (!data.entries.length) {
            tableBodyHTML = `<tr><td colspan="4" class="sup-empty-box">Nenhuma ocorrência registrada para o filtro selecionado neste mês.</td></tr>`;
        } else {
            tableBodyHTML = data.entries.map(item => {
                const redCls = (item.isSunday || item.holiday) ? ' sup-is-red' : '';
                const obsHTML = item.text
                    ? `<div class="sup-obs-text">${escapeHTML(item.text)}</div>`
                    : `<div class="sup-obs-text sup-obs-empty">—</div>`;

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
                            <span class="sup-shift-chip a4-cell-${item.chipPaletteKey}">${escapeHTML(item.chipCode)}</span>
                            <div>
                                <span class="sup-shift-name">${escapeHTML(item.shiftLabel)}</span>
                                <span class="sup-shift-hours">${escapeHTML(item.shiftSub)}</span>
                            </div>
                        </div>
                    </td>
                    <td>${obsHTML}</td>
                </tr>`;
            }).join('');
        }

        return `<div class="sup-sheet">
            <div class="a4-header">
                <div class="a4-brand">
                    <img class="a4-logo" src="${IMERYS_SVG_URI}" alt="Imerys">
                    <div>
                        <h2 class="a4-title">RELATÓRIO DE OCORRÊNCIAS MENSAIS</h2>
                        <div class="a4-subtitle">IMERYS • BRITAGEM ICP 1 • ENCARREGADO &amp; SUPERVISOR DE BRITAGEM</div>
                    </div>
                </div>
                <div class="a4-period-box">
                    <span class="a4-month-pill">${escapeHTML(data.monthLabel)}</span>
                    <span class="a4-cycle-note">${escapeHTML(data.scopeLabel)} • ${escapeHTML(data.sortLabel)}</span>
                </div>
            </div>

            <div class="sup-kpi-grid">${kpiCardsHTML}</div>

            <div class="sup-meta-bar">
                <div class="sup-meta-teams">
                    <span>Ocorrências por turno:</span>
                    ${teamMetaChips}
                </div>
                <span>Dias com ocorrência: ${data.uniqueDays} de ${data.daysInMonth}</span>
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
                <span>Imerys • Britagem ICP 1 • Relatório de Ocorrências Mensais (Fechamento)</span>
                <span>Emitido em ${data.issuedStr} • Formato A4 Horizontal</span>
            </div>
        </div>`;
    }

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
        const sortDateBtn = document.getElementById('sup-sort-date-btn');

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
        if (sortDateBtn && supData) sortDateBtn.innerText = `Por Data (1 → ${supData.daysInMonth})`;

        if (pill) {
            pill.innerText = isSup ? 'Fechamento Mensal • Encarregado / Supervisor' : 'Quadro de Avisos • A4 Horizontal';
            pill.className = isSup
                ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-200/70 dark:border-indigo-900/50 mb-1.5'
                : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-200/70 dark:border-blue-900/50 mb-1.5';
        }
        if (title) title.innerText = isSup ? 'Relatório de Ocorrências Mensais' : 'Exportar & Imprimir Escala';
        if (sub) sub.innerText = isSup
            ? 'Soma separada por categoria, motivo por extenso e observações do mês.'
            : 'Todos os 4 turnos, horários, totais e feriados — sem observações individuais.';
        if (caption) caption.innerText = isSup
            ? 'Prévia do Relatório (A4 Paisagem • Role para conferir)'
            : 'Prévia da Folha A4 (Paisagem • 1 Página)';

        quadroOpts?.classList.toggle('hidden', isSup);
        supOpts?.classList.toggle('hidden', !isSup);
        copyBtn?.classList.toggle('hidden', !isSup);
        if (printLbl) printLbl.innerText = isSup ? 'Imprimir / PDF Ocorrências' : 'Imprimir / Salvar PDF (A4)';
        if (pngLbl) pngLbl.innerText = isSup ? 'Baixar Relatório HD (.PNG)' : 'Baixar Imagem A4 HD (.PNG)';

        if (countPill && supData) {
            countPill.innerText = `${supData.totalNotes} ${supData.totalNotes === 1 ? 'ocorrência' : 'ocorrências'}`;
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
            const naturalH = isSup ? Math.max(793, scaler.scrollHeight || 793) : 793;
            spacer.style.height = `${Math.ceil(naturalH * scale)}px`;
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
            if (printEl) { printEl.classList.add('is-supervisor-print'); printEl.innerHTML = html; }
            if (scaler) scaler.innerHTML = html;
            if (badge) badge.innerText = supData.monthLabel;
            requestAnimationFrame(applyScaledPreview);
            return supData;
        } else {
            const quadroData = buildA4Dataset(a4IncludeChanges);
            const html = buildA4SheetHTML(quadroData);
            if (printEl) { printEl.classList.remove('is-supervisor-print'); printEl.innerHTML = html; }
            if (scaler) scaler.innerHTML = html;
            if (badge) badge.innerText = quadroData.monthLabel;
            requestAnimationFrame(applyScaledPreview);
            return quadroData;
        }
    }

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
                        let chunk = '';
                        for (let ch of word) {
                            if (ctx.measureText(chunk + ch).width > maxW && chunk) { result.push(chunk); chunk = ch; }
                            else chunk += ch;
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
        const colDateW = 184, colTeamW = 410, colShiftW = 588;
        const colObsW = contentW - colDateW - colTeamW - colShiftW;

        const mCanvas = document.createElement('canvas');
        const mCtx = mCanvas.getContext('2d');
        const measuredRows = data.entries.map(item => {
            const chipW = item.chipCode.length >= 4 ? 76 : 62;
            const shiftTextMaxW = colShiftW - (chipW + 54);
            mCtx.font = `900 21px ${font}`;
            const shiftLines = wrapCanvasLines(mCtx, item.shiftLabel, shiftTextMaxW);
            const shiftBlockH = shiftLines.length * 28 + 30;

            mCtx.font = `600 24px ${font}`;
            const obsLines = item.text ? wrapCanvasLines(mCtx, item.text, colObsW - 44) : ['—'];
            const obsBlockH = obsLines.length * 34;

            const rowH = Math.max(106, shiftBlockH + 40, obsBlockH + 44);
            return { item, chipW, shiftLines, obsLines, rowH };
        });

        const headerBottomY = padTop + 114 + 24;
        const kpiY = headerBottomY + 26, kpiH = 126;
        const metaY = kpiY + kpiH + 16, metaH = 54;
        const tblY = metaY + metaH + 22, tblHeadH = 68;
        const rowsTotalH = measuredRows.length ? measuredRows.reduce((acc, r) => acc + r.rowH, 0) : 260;
        const signBlockH = 136, footerBlockH = 74;
        const neededH = tblY + tblHeadH + rowsTotalH + signBlockH + footerBlockH + 44;
        const H = Math.max(1654, neededH);

        /* Proteção contra limite de 16.7MP do Canvas no iOS Safari */
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
        ctx.fillStyle = '#0f172a'; ctx.font = `900 46px ${font}`;
        ctx.fillText('RELATÓRIO DE OCORRÊNCIAS MENSAIS', padX + logoSize + 28, padTop + 12);
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
        ctx.fillText(canvasTruncateText(ctx, `${data.scopeLabel} • ${data.sortLabel}`, 940), W - padX, pillY + pillH + 14);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(padX, headerBottomY, contentW, 5);

        /* 2. Soma Separada por Categoria + Total de Ocorrências no Final */
        const cc = data.categoryCounts;
        const kpiItems = [
            { label: 'HORA EXTRA',      val: cc.extras,    accent: '#d97706', isTotal: false },
            { label: 'ATESTADOS',       val: cc.atestados, accent: '#e11d48', isTotal: false },
            { label: 'FALTAS',          val: cc.faltas,    accent: '#dc2626', isTotal: false },
            { label: 'TROCAS',          val: cc.trocas,    accent: '#7c3aed', isTotal: false },
            { label: 'ENT. ATRASADA',   val: cc.atrasos,   accent: '#0891b2', isTotal: false },
            { label: 'SAÍDA ADIANT.',   val: cc.saidas,    accent: '#0d9488', isTotal: false },
            { label: 'OUTRAS / FOLGAS', val: cc.outras,    accent: '#64748b', isTotal: false },
            { label: 'TOTAL OCORRÊNCIAS', val: data.totalNotes, accent: '#0f172a', isTotal: true }
        ];
        const kGap = 16;
        const unitW = (contentW - kGap * 7) / 8.25;
        let curKX = padX;
        kpiItems.forEach(item => {
            const w = item.isTotal ? Math.round(unitW * 1.25) : Math.round(unitW);
            ctx.save();
            canvasRoundRect(ctx, curKX, kpiY, w, kpiH, 16);
            ctx.fillStyle = item.isTotal ? '#0f172a' : '#f8fafc';
            ctx.fill();
            ctx.strokeStyle = item.isTotal ? '#0f172a' : '#cbd5e1';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            if (!item.isTotal) {
                ctx.clip();
                ctx.fillStyle = item.accent;
                ctx.fillRect(curKX, kpiY, w, 7);
            }
            ctx.restore();

            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillStyle = item.isTotal ? '#cbd5e1' : '#475569';
            ctx.font = `900 15px ${font}`;
            ctx.fillText(canvasTruncateText(ctx, item.label, w - 28), curKX + 16, kpiY + 20);

            ctx.fillStyle = item.isTotal ? '#ffffff' : '#0f172a';
            ctx.font = `900 44px ${font}`;
            ctx.fillText(String(item.val), curKX + 16, kpiY + 50);

            if (item.isTotal) {
                ctx.fillStyle = '#94a3b8';
                ctx.font = `700 15px ${font}`;
                const subTot = data.teamFilter === 'all' ? 'Soma geral do mês' : `de ${data.totalAllMonth} no mês`;
                ctx.fillText(canvasTruncateText(ctx, subTot, w - 28), curKX + 16, kpiY + 98);
            }
            curKX += w + kGap;
        });

        /* Barra auxiliar de Turnos + Dias com ocorrência */
        canvasRoundRect(ctx, padX, metaY, contentW, metaH, 12);
        ctx.fillStyle = '#f1f5f9'; ctx.fill();
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.stroke();

        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#334155'; ctx.font = `800 19px ${font}`;
        ctx.fillText('Ocorrências por turno:', padX + 20, metaY + metaH / 2);

        let mx = padX + 245;
        TEAM_LETTERS.forEach((ltr, idx) => {
            const txt = `Turno ${ltr}: ${data.perTeam[idx] || 0}`;
            ctx.font = `900 18px ${font}`;
            const tw = ctx.measureText(txt).width + 26;
            const isDim = data.teamFilter !== 'all' && String(idx) !== String(data.teamFilter);
            ctx.save();
            if (isDim) ctx.globalAlpha = 0.45;
            canvasRoundRect(ctx, mx, metaY + 10, tw, metaH - 20, 8);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(txt, mx + tw / 2, metaY + metaH / 2 + 1);
            ctx.restore();
            mx += tw + 14;
        });

        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#334155'; ctx.font = `800 19px ${font}`;
        ctx.fillText(`Dias com ocorrência: ${data.uniqueDays} de ${data.daysInMonth}`, padX + contentW - 20, metaY + metaH / 2);

        /* 3. Tabela de Ocorrências */
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
            ctx.fillText('Nenhuma ocorrência registrada para o filtro selecionado neste mês.', padX + contentW / 2, curY + 130);
            curY += 260;
        } else {
            measuredRows.forEach((row, rIdx) => {
                const { item, chipW, shiftLines, obsLines, rowH } = row;
                ctx.fillStyle = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                ctx.fillRect(padX, curY, contentW, rowH);

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

                /* Turno / Equipe (somente Turno + nomes dos trabalhadores) */
                canvasRoundRect(ctx, colX1 + 22, curY + 22, 42, 42, 10);
                ctx.fillStyle = '#0f172a'; ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.font = `900 22px ${font}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(item.letter, colX1 + 43, curY + 44);

                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillStyle = '#0f172a'; ctx.font = `900 23px ${font}`;
                ctx.fillText(`Turno ${item.letter}`, colX1 + 78, curY + 20);
                ctx.fillStyle = '#475569'; ctx.font = `700 20px ${font}`;
                ctx.fillText(canvasTruncateText(ctx, item.teamName, colTeamW - 96), colX1 + 78, curY + 51);

                /* Escala do Dia (motivo da ocorrência por extenso + subtítulo) */
                const pal = PALETTE[item.chipPaletteKey] || PALETTE.M;
                canvasRoundRect(ctx, colX2 + 22, curY + 22, chipW, 42, 10);
                ctx.fillStyle = pal.bg; ctx.fill();
                ctx.fillStyle = pal.fg; ctx.font = `900 20px ${font}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(item.chipCode, colX2 + 22 + chipW / 2, curY + 43);

                const shiftTxtX = colX2 + 22 + chipW + 14;
                const shiftMaxW = colShiftW - (chipW + 54);
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillStyle = '#0f172a'; ctx.font = `900 21px ${font}`;
                shiftLines.forEach((ln, li) => {
                    ctx.fillText(ln, shiftTxtX, curY + 20 + li * 28);
                });
                ctx.fillStyle = '#475569'; ctx.font = `700 18px ${font}`;
                ctx.fillText(canvasTruncateText(ctx, item.shiftSub, shiftMaxW), shiftTxtX, curY + 24 + shiftLines.length * 28);

                /* Observação Registrada (somente texto digitado) */
                ctx.fillStyle = item.text ? '#0f172a' : '#94a3b8';
                ctx.font = `600 24px ${font}`;
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                obsLines.forEach((ln, li) => {
                    ctx.fillText(ln, colX3 + 22, curY + 22 + li * 34);
                });

                curY += rowH;
            });
        }
        ctx.restore();

        canvasRoundRect(ctx, padX, tblY, contentW, tblTotalH, 16);
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.stroke();

        /* 4. Assinaturas */
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
        ctx.fillText('Imerys • Britagem ICP 1 • Relatório de Ocorrências Mensais (Fechamento)', padX, footY);
        ctx.textAlign = 'right';
        ctx.fillText(`Emitido em ${data.issuedStr} • Formato A4 Horizontal (HD)`, W - padX, footY);

        const suffix = data.teamFilter === 'all' ? 'Todos' : `Turno_${TEAM_LETTERS[parseInt(data.teamFilter, 10)]}`;
        triggerCanvasDownload(c, `Relatorio_Ocorrencias_Mensais_Imerys_${suffix}_${data.mmStr}_${data.year}.png`, 'Relatório HD (.PNG) baixado!');
    }

    function copyTextFallback(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(ta);
        ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
    }

    async function copySupervisorSummary() {
        haptic();
        const data = buildSupervisorDataset(supTeamFilter, supSortMode);
        const cc = data.categoryCounts;
        const lines = [
            `*RELATÓRIO DE OCORRÊNCIAS MENSAIS*`,
            `Imerys • Britagem ICP 1`,
            `Período: *${data.monthLabel}*`,
            `Escopo: ${data.scopeLabel} | ${data.sortLabel}`,
            `Soma por tipo: Hora Extra (${cc.extras}) • Atestados (${cc.atestados}) • Faltas (${cc.faltas}) • Trocas (${cc.trocas}) • Ent. Atrasada (${cc.atrasos}) • Saída Adiant. (${cc.saidas}) • Outras/Folgas (${cc.outras})`,
            `*Total de Ocorrências:* ${data.totalNotes} (em ${data.uniqueDays} de ${data.daysInMonth} dias)`,
            `Por turno: A (${data.perTeam[0]}) • B (${data.perTeam[1]}) • C (${data.perTeam[2]}) • D (${data.perTeam[3]})`,
            `----------------------------------------`
        ];

        if (!data.entries.length) {
            lines.push('Nenhuma ocorrência registrada para o filtro selecionado neste mês.');
        } else {
            data.entries.forEach(item => {
                lines.push(`• *${item.dateStr} (${item.dowPretty})* — *Turno ${item.letter}* (${item.teamName}) — ${item.shiftLabel} (${item.shiftSub})`);
                if (item.text) lines.push(`  Obs: ${item.text.replace(/\r?\n/g, '\n  ')}`);
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

    /* ------------------------------------------------------------------------
       10. BACKUP JSON (v6) E EXPORTAÇÃO AGENDA (.ICS)
       ------------------------------------------------------------------------ */
    window.exportBackup = function () {
        haptic();
        const payload = {
            version: 6,
            exportedAt: new Date().toISOString(),
            turma: currentTurma,
            teams: teamNames,
            notes: notesDb,
            overrides: overridesDb,
            overrideMeta: overrideMetaDb,
            atestados: atestadosDb
        };
        const url = window.URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.setAttribute('download', 'Backup_Escala_Imerys.json');
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        showToast('Backup exportado com sucesso!');
    };

    window.importBackup = function (event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const validTurma = (typeof data.turma === 'number' && Number.isInteger(data.turma) && data.turma >= 0 && data.turma <= 3) ? data.turma : currentTurma;
                currentTurma = validTurma;
                if (Array.isArray(data.teams) && data.teams.length === 4) {
                    teamNames = sanitizeTeamList(data.teams);
                }
                if (data.notes && typeof data.notes === 'object' && !Array.isArray(data.notes)) {
                    Object.entries(data.notes).forEach(([k, val]) => {
                        const txt = String(val || '').trim();
                        if (!txt) return;
                        if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k)) notesDb[k] = txt;
                        else if (/^\d{4}-\d{2}-\d{2}$/.test(k)) notesDb[getNoteKey(k, validTurma)] = txt;
                    });
                }
                if (data.overrides && typeof data.overrides === 'object' && !Array.isArray(data.overrides)) {
                    Object.entries(data.overrides).forEach(([k, val]) => {
                        if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k) && VALID_OVERRIDES.includes(val)) overridesDb[k] = val;
                    });
                }
                if (data.overrideMeta && typeof data.overrideMeta === 'object' && !Array.isArray(data.overrideMeta)) {
                    Object.entries(data.overrideMeta).forEach(([k, val]) => {
                        if (/^\d{4}-\d{2}-\d{2}_[0-3]$/.test(k) && val && typeof val === 'object') {
                            const wt = ['0', '1', 'both'].includes(String(val.whoType)) ? String(val.whoType) : 'both';
                            overrideMetaDb[k] = {
                                whoType: wt,
                                whoName: typeof val.whoName === 'string' ? val.whoName.trim().slice(0, 40) : '',
                                swapWith: typeof val.swapWith === 'string' ? val.swapWith.trim().slice(0, 40) : '',
                                swapWithTeam: typeof val.swapWithTeam === 'string' ? val.swapWithTeam.trim().slice(0, 2) : ''
                            };
                        }
                    });
                }
                if (Array.isArray(data.atestados)) {
                    const byKey = new Map(atestadosDb.map(a => [`${a.startDate}_${a.turma}`, a]));
                    data.atestados.forEach(item => {
                        if (item && isValidDateKey(item.startDate) && Number.isInteger(item.turma) && item.turma >= 0 && item.turma <= 3 && item.days >= 1) {
                            const wt = ['0', '1', 'both'].includes(String(item.whoType)) ? String(item.whoType) : 'both';
                            byKey.set(`${item.startDate}_${item.turma}`, {
                                id: item.id || `at_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                turma: item.turma,
                                startDate: item.startDate,
                                days: Math.max(1, Math.min(180, parseInt(item.days, 10) || 1)),
                                whoType: wt,
                                whoName: typeof item.whoName === 'string' ? item.whoName.trim().slice(0, 40) : ''
                            });
                        }
                    });
                    atestadosDb = Array.from(byKey.values());
                }
                sanitizeAllData();
                DB.flushAll();
                closeInfoModal();
                renderApp(false);
                updateStorageHealthUI();
                showToast('Backup restaurado com sucesso!');
            } catch (err) {
                showToast('Arquivo de backup inválido.');
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    window.exportICS = function () {
        haptic();
        const year = currentDate.getFullYear(), month = currentDate.getMonth(), daysInMonth = new Date(year, month + 1, 0).getDate();
        const turmaLtr = TEAM_LETTERS[currentTurma], teamLabel = `Turno ${turmaLtr} (${teamNames[currentTurma]})`;
        showToast(`Exportando agenda do Turno ${turmaLtr}...`);
        const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Escala Imerys Britagem ICP1//PT-BR', 'CALSCALE:GREGORIAN'];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = formatDateKey(year, month, day);
            const atInfo = findAtestadoOnDate(dateKey, currentTurma);
            if (atInfo) {
                const whoInfo = resolveWhoInfo(atInfo.record, currentTurma);
                const sD = new Date(year, month, day, 12, 0, 0), eD = new Date(year, month, day + 1, 12, 0, 0);
                const reason = getAtestadoReason(atInfo.record);
                let desc = `${teamLabel} - Atestado Médico (${whoInfo.fullLabel}) • ${atInfo.dayIndex}/${atInfo.totalDays}`;
                if (reason) desc += `\nObservação: ${reason}`;
                lines.push('BEGIN:VEVENT', `UID:imerys-${turmaLtr}-AT-${dateKey}@escala.local`, `DTSTAMP:${dtStamp}`, `DTSTART;VALUE=DATE:${formatICSAllDay(sD)}`, `DTEND;VALUE=DATE:${formatICSAllDay(eD)}`, `SUMMARY:${sanitizeICS(`Imerys - Atestado (${whoInfo.label}) ${atInfo.dayIndex}/${atInfo.totalDays}`)}`, `DESCRIPTION:${sanitizeICS(desc)}`, 'END:VEVENT');
                continue;
            }
            const ov = overridesDb[`${dateKey}_${currentTurma}`] || '';
            const ovMeta = getOverrideMeta(dateKey, currentTurma);
            const dayNote = getNote(dateKey, currentTurma);
            if (ov === 'FA') {
                const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: currentTurma } : { turma: currentTurma, whoType: 'both' }, currentTurma);
                const sD = new Date(year, month, day, 12, 0, 0), eD = new Date(year, month, day + 1, 12, 0, 0);
                let desc = `${teamLabel} - Falta (${who.fullLabel})`;
                if (dayNote) desc += `\nNota: ${dayNote}`;
                lines.push('BEGIN:VEVENT', `UID:imerys-${turmaLtr}-FA-${dateKey}@escala.local`, `DTSTAMP:${dtStamp}`, `DTSTART;VALUE=DATE:${formatICSAllDay(sD)}`, `DTEND;VALUE=DATE:${formatICSAllDay(eD)}`, `SUMMARY:${sanitizeICS(`Imerys - Falta (${who.label})`)}`, `DESCRIPTION:${sanitizeICS(desc)}`, 'END:VEVENT');
                continue;
            }

            const sCode = getEffectiveShift(dateKey, currentTurma);
            const isExtra = isExtraOverride(ov);
            const isTd = ov === 'TD';
            const isEaSa = ov === 'EA' || ov === 'SA';
            if (sCode === 'F' && !isExtra && !isTd && !isEaSa) continue;

            const ovMetaInfo = OVERRIDE_META[ov];
            let tagSuffix = '';
            if (ov === 'HE50' || ov === 'HE75' || ov === 'HE110' || ov === 'EA' || ov === 'SA') {
                const who = resolveWhoInfo(ovMeta ? { ...ovMeta, turma: currentTurma } : { turma: currentTurma, whoType: 'both' }, currentTurma);
                tagSuffix = ` (${ovMetaInfo.label} - ${who.label})`;
            } else if (isTd) {
                const swap = formatSwapDisplay(ovMeta, currentTurma);
                tagSuffix = ` (Troca: ${swap.fullLabel})`;
            } else if (ovMetaInfo) {
                tagSuffix = ` (${ovMetaInfo.label})`;
            }

            let desc = `${teamLabel}${tagSuffix}`;
            if (dayNote) desc += `\nNota: ${dayNote}`;

            if (sCode === 'F') {
                const sD = new Date(year, month, day, 12, 0, 0), eD = new Date(year, month, day + 1, 12, 0, 0);
                lines.push('BEGIN:VEVENT', `UID:imerys-${turmaLtr}-${dateKey}@escala.local`, `DTSTAMP:${dtStamp}`, `DTSTART;VALUE=DATE:${formatICSAllDay(sD)}`, `DTEND;VALUE=DATE:${formatICSAllDay(eD)}`, `SUMMARY:${sanitizeICS(`Imerys - ${ovMetaInfo ? ovMetaInfo.label : 'Folga'}${tagSuffix}`)}`, `DESCRIPTION:${sanitizeICS(desc)}`, 'END:VEVENT');
            } else {
                const sCfg = SHIFTS_CONFIG[sCode] || SHIFTS_CONFIG.M;
                const [startHr, endHr] = sCfg.hours.split('-');
                const sD = new Date(year, month, day, 12, 0, 0), eD = new Date(year, month, day, 12, 0, 0);
                if (sCode === 'N') eD.setDate(eD.getDate() + 1);
                lines.push('BEGIN:VEVENT', `UID:imerys-${turmaLtr}-${dateKey}@escala.local`, `DTSTAMP:${dtStamp}`, `DTSTART:${formatICSDate(sD, startHr)}`, `DTEND:${formatICSDate(eD, endHr)}`, `SUMMARY:${sanitizeICS(`Imerys - ${sCfg.name}${tagSuffix}`)}`, `DESCRIPTION:${sanitizeICS(desc)}`, 'END:VEVENT');
            }
        }
        lines.push('END:VCALENDAR');
        const url = window.URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.setAttribute('download', `Escala_Turno_${turmaLtr}_${String(month + 1).padStart(2, '0')}_${year}.ics`);
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    };

    /* ------------------------------------------------------------------------
       11. EXPORTAÇÃO, IMPRESSÃO E INICIALIZAÇÃO SEGURA (SEM CONDIÇÃO DE CORRIDA)
       ------------------------------------------------------------------------ */
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
    window.downloadA4PNG = downloadQuadroA4PNG;
    window.copySupervisorSummary = copySupervisorSummary;

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
            ? `Relatorio_Ocorrencias_Mensais_Imerys_${data.mmStr}_${data.year}`
            : `Escala_Imerys_Quadro_A4_${data.mmStr}_${data.year}`;
        const restore = () => { document.title = originalTitle; };
        window.addEventListener('afterprint', restore, { once: true });
        setTimeout(() => { window.print(); setTimeout(restore, 1500); }, 60);
    };

    window.triggerExportPNG = function () {
        if (exportMode === 'supervisor') return downloadSupervisorPNG();
        return downloadQuadroA4PNG();
    };

    function bindSupervisorPrintHook() {
        if (printHookBound) return;
        printHookBound = true;
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

    /* Prepara estilos e DOM imediatamente antes do bootApp() disparar */
    function prepareUpgrades() {
        injectModuleStyles();
        ensureObservationsCardDOM();
        upgradeInfoModalDOM();
        upgradeNoteModalDOM();
        upgradeExportModalDOM();
        upgradeDesktopInlineLegend();
        sanitizeAllData();
    }

    prepareUpgrades();

    if (document.readyState === 'loading') {
        /* Roda logo após o bootApp() do index.html para garantir ordem correta do beforeprint */
        document.addEventListener('DOMContentLoaded', () => {
            prepareUpgrades();
            bindSupervisorPrintHook();
            const tableEl = document.getElementById('main-table');
            if (tableEl && !tableEl.children.length) {
                renderApp(true);
            }
        });
    } else {
        /* Se o bootApp() já rodou antes do script carregar, vincula o print hook e re-renderiza */
        bindSupervisorPrintHook();
        renderApp(true);
    }
})();
