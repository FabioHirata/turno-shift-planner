export const LANGUAGES = ['pt', 'en', 'ja'];
export const DAYS_LOCAL = { pt: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'], en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], ja: ['月','火','水','木','金','土','日'] };
export const SHIFT_LOCAL = { pt: {off:'Folga',morning:'Manhã',afternoon:'Tarde'}, en: {off:'Off',morning:'Morning',afternoon:'Afternoon'}, ja: {off:'休み',morning:'早番',afternoon:'遅番'} };
// Source Portuguese phrases double as stable keys. Every entry has EN and JA.
export const COPY = {
'Ir para a escala':['Skip to schedule','シフト表へ移動'],
'ESPAÇO DEMONSTRATIVO':['DEMO WORKSPACE','デモワークスペース'],
'Ateliê Aurora':['Aurora Studio','アウロラ・スタジオ'],
'Equipe de atendimento':['Customer service team','接客チーム'],
'Escala semanal':['Weekly schedule','週間シフト'],
'Disponibilidade':['Availability','勤務可能時間'],
'Sobre o projeto':['About the project','プロジェクトについて'],
'FEITO PARA EXPLORAR':['BUILT TO EXPLORE','操作して試せるデモ'],
'Menos planilha.':['Less spreadsheet.','表計算をもっとシンプルに。'],
'Mais clareza na operação.':['More operational clarity.','チームの予定を、ひと目で。'],
'Demo de portfólio · v1.0':['Portfolio demo · v1.0','ポートフォリオ用デモ · v1.0'],
'Operação':['Operations','運用'],
'Planejamento':['Planning','計画'],
'Dados fictícios':['Fictional data','架空のデータ'],
'ORGANIZE A SEMANA':['PLAN YOUR WEEK','1週間を見通す'],
'Cada turno, no lugar certo.':['The right plan for every shift.','シフトを整え、チームを支える。'],
'Planeje a equipe. Confira a cobertura. Antecipe conflitos.':['Plan your team. Check coverage. Catch conflicts early.','チームの予定を立て、必要な人数と問題点を確認。'],
'Exportar CSV':['Export CSV','CSVを書き出す'],
'02 — 08 novembro, 2026':['November 2–8, 2026','2026年11月2日〜8日'],
'Semana fixa para demonstração':['Fixed week for this demo','デモ用の固定週'],
'Salvo neste navegador':['Saved in this browser','このブラウザに保存済み'],
'Dados locais inválidos; exemplo carregado':['Invalid local data; demo loaded','保存データが無効なため、デモを読み込みました'],
'Armazenamento indisponível; use CSV para guardar':['Storage unavailable; export CSV to save','保存機能を利用できません。CSVで保存してください'],
'Não foi possível salvar; use CSV para guardar':['Could not save; export CSV to keep your changes','保存できませんでした。CSVで変更内容を保存してください'],
'Turnos cobertos':['Shifts covered','必要人数を満たすシフト'],
'Meta: 1 pessoa disponível por turno':['Target: 1 available person per shift','各シフトに勤務可能な担当者1名が必要'],
'Horas planejadas':['Planned hours','予定勤務時間'],
'Turnos de 8h · equipe de 4 pessoas':['8-hour shifts · team of 4','1シフト8時間 · チーム4名'],
'Pontos de atenção':['Items to review','確認が必要な項目'],
'Escala da equipe':['Team schedule','チームのシフト表'],
'Selecione um turno para editar. As verificações são imediatas.':['Select a shift to edit. Checks update instantly.','シフトを選んで変更。確認結果はすぐに反映されます。'],
'Restaurar demo':['Reset demo','デモをリセット'],
'Manhã · 08–16h':['Morning · 08:00–16:00','早番 · 08:00〜16:00'],
'Tarde · 16–00h':['Afternoon · 16:00–00:00','遅番 · 16:00〜翌00:00'],
'Folga':['Off','休み'],
'Escala semanal; role para ver todos os dias':['Weekly schedule; scroll to see all days','週間シフト表。スクロールして全日程を表示'],
'Atribuição de um turno por pessoa por dia':['One shift assignment per person per day','1人につき1日1シフトを割り当て'],
'EQUIPE':['TEAM','チーム'], 'TOTAL':['TOTAL','合計'],
'A cobertura considera apenas pessoas disponíveis. Folgas e turnos indisponíveis não preenchem a meta.':['Coverage counts available people only. Time off and unavailable assignments do not meet the target.','勤務可能な人のみ必要人数にカウントします。休みや勤務不可の割り当ては対象外です。'],
'01 / VALIDAÇÃO':['01 / VALIDATION','01 / 確認'],
'Antes de fechar a semana':['Before you finalize the week','週間予定の確定前に'],
'02 / DISPONIBILIDADE':['02 / AVAILABILITY','02 / 勤務可能時間'],
'Combinados da equipe':['Team availability','チームの勤務条件'],
'Restrições fixas deste cenário fictício.':['Fixed restrictions for this fictional scenario.','この架空のシナリオで設定された条件です。'],
'Sáb e dom · indisponível':['Sat & Sun · unavailable','土・日 · 勤務不可'],
'Qua · manhã indisponível':['Wed · morning unavailable','水 · 早番は勤務不可'],
'Ter · tarde indisponível':['Tue · afternoon unavailable','火 · 遅番は勤務不可'],
'Seg · manhã indisponível':['Mon · morning unavailable','月 · 早番は勤務不可'],
'Referência da demo: até 40h por pessoa / semana.':['Demo guideline: up to 40 hours per person / week.','デモの基準：1人につき週40時間まで。'],
'Um laboratório de planejamento.':['A planning sandbox.','シフト計画を試せる実験室。'],
'Projeto demonstrativo de portfólio. Pessoas, negócio e escala são fictícios. Sem servidor, contas ou rastreamento. Não valida legislação trabalhista nem substitui revisão humana.':['A portfolio demonstration. All people, business details and schedules are fictional. No backend, accounts or tracking. Does not validate labor law or replace human review.','ポートフォリオ用のデモです。人物・店舗・シフトはすべて架空です。バックエンド、アカウント、追跡機能はありません。労働法への適合性を検証するものではなく、人による確認が必要です。'],
'JavaScript nativo · Regras testáveis · Dados locais':['Vanilla JavaScript · Testable rules · Local data','素のJavaScript · テスト可能なルール · ローカルデータ'],
'Restaurar a demonstração?':['Reset the demonstration?','デモをリセットしますか？'],
'As edições desta escala serão substituídas pelo exemplo inicial.':['Your schedule changes will be replaced with the initial example.','編集したシフト表は初期データに置き換わります。'],
'Manter edições':['Keep changes','変更を残す'], 'Restaurar':['Reset','リセット'],
'Atendimento':['Customer service','接客'],
' · indisponível':[' · unavailable',' · 勤務不可'],
'! Indisponível':['! Unavailable','! 勤務不可'],
'Cobertura válida':['Valid coverage','勤務可能な人数'],
'✓ Tudo certo neste cenário: cobertura completa e nenhuma regra da demo violada.':['✓ All clear in this scenario: full coverage and no demo rule violations.','✓ このシナリオでは必要人数を満たし、デモのルール違反もありません。'],
'Exportação CSV iniciada. O arquivo inclui a escala, mesmo se houver conflitos.':['CSV export started. The file includes the schedule even if conflicts remain.','CSVの書き出しを開始しました。問題が残っている場合も、そのまま出力されます。'],
'Demonstração restaurada.':['Demo reset.','デモをリセットしました。'],
'Turno — Planejador de escalas':['Turno — Shift planner','Turno — シフトプランナー'],
'Principal':['Main navigation','メインナビゲーション'],
'Resumo da semana':['Weekly summary','週間サマリー'],
};
export function translate(key, lang) { return lang === 'pt' ? key : (COPY[key]?.[lang === 'ja' ? 1 : 0] ?? key); }
export const hoursText = (n, lang) => new Intl.NumberFormat(lang).format(n) + (lang === 'ja' ? '時間' : 'h');
export function summary(conflicts, gaps, lang) {
  return lang === 'ja' ? `${conflicts}件の問題 · ${gaps}シフトが人員不足` : lang === 'en' ? `${conflicts} conflict(s) · ${gaps} uncovered shift(s)` : `${conflicts} conflito(s) · ${gaps} turno(s) descoberto(s)`;
}
export function gapText(day, shift, lang) {
  return lang === 'ja' ? `${DAYS_LOCAL.ja[day]}曜日：${SHIFT_LOCAL.ja[shift]}の担当者が1名不足しています。` : lang === 'en' ? `${DAYS_LOCAL.en[day]}: 1 available person needed for the ${SHIFT_LOCAL.en[shift].toLowerCase()} shift.` : `${DAYS_LOCAL.pt[day]}: falta 1 pessoa disponível no turno da ${SHIFT_LOCAL.pt[shift].toLowerCase()}.`;
}
export function conflictText(c, people, hours, lang) {
  const p = people.find(p => p.id === c.personId);
  if (lang === 'pt') return c.text;
  if (c.type === 'hours') return lang === 'ja' ? `${p.name}：${hours[p.id]}時間はデモの週40時間の上限を超えています。` : `${p.name}: ${hours[p.id]}h exceeds the demo limit of 40h.`;
  return lang === 'ja' ? `${p.name}：${DAYS_LOCAL.ja[c.day]}曜日は選択したシフトに勤務できません。` : `${p.name}: unavailable for the selected shift on ${DAYS_LOCAL.en[c.day]}.`;
}
