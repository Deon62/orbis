#!/usr/bin/env node
/* Build the free course intros as real PDFs, printed from HTML by Chrome.
 *
 * The Academy cards link to these, so they have to be typeset documents rather
 * than a page of text in a wrapper. Chrome prints them from the template below,
 * which carries the wordmark, the brand rule and the page furniture.
 *
 *     npm i puppeteer-core && node scripts/build-pdfs.js   ->  assets/pdf/*.pdf
 *
 * The built PDFs are committed, so this only has to run when the copy changes.
 * It drives the Chrome already installed on the machine; set CHROME to point at
 * another one.
 */
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) {
  console.error('This generator needs puppeteer-core: npm i puppeteer-core');
  process.exit(1);
}
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '../assets/pdf');

const COURSES = [
  {
    file: 'orbisflow-foundations-intro',
    course: 'Foundations',
    title: 'Your first ten trades',
    lead: 'What a binary contract is, what decides the payout, and how to spend your first ten trades on demo without learning the wrong lesson.',
    sections: [
      ['A contract, in one sentence',
       'A binary contract asks one question: will this market be higher or lower than it is now, when the clock runs out? You choose the market, the direction, the stake and the duration. If you are right the payout is fixed and known before you commit. If you are wrong the stake is gone. Nothing about the size of the move changes either number, which is what makes it different from every other instrument you have read about.'],
      ['Where the payout comes from',
       'A payout of 88% is not a fee schedule, it is a price. It reflects how likely the market is to finish where you say it will, plus the spread the platform takes for standing on the other side. A short duration on a quiet market pays less, because it is easier to call. When you see a payout jump, the market has become harder to predict, not more generous.'],
      ['The first ten trades',
       'Place all ten on demo, all at the same stake, all on one market, all at the same duration. You are not trying to make money; you are removing every variable but one so you can see your own decisions. Write down why you took each one before the result lands. After ten, read the reasons back. Most people find that four or five had no reason at all beyond impatience.'],
      ['What to take from it',
       'Three things tell you whether you are ready for the next course: you can state the payout and the duration of a trade before you place it, you can sit through a losing streak without doubling the stake, and you can explain in one sentence why you entered. Nothing in the rest of trading gets easier until those three are automatic.']
    ]
  },
  {
    file: 'orbisflow-practitioner-intro',
    course: 'Practitioner',
    title: 'The risk sheet',
    lead: 'Position sizing is the only part of trading you fully control. This is the arithmetic that decides whether a run of losses is a bad week or the end of the account.',
    sections: [
      ['Why stake size beats accuracy',
       'A trader who is right 60% of the time and stakes a quarter of the account per trade will go broke. A trader who is right 55% of the time and stakes 2% will not. Losing streaks are longer than intuition suggests: at a 55% strike rate, a run of six losses turns up roughly once every two hundred trades. Your stake has to be small enough that the run is survivable and boring.'],
      ['The 2% rule, and what it costs',
       'Risk no more than 2% of the account on one contract. On a $1,000 account that is $20. It feels slow, and that is the point: at 2%, ten consecutive losses leaves you with about $817 and a working account. At 10% the same streak leaves $349, and you now need to triple what is left simply to return to where you started. Recovery is not linear, which is why survival is the first objective.'],
      ['Daily loss limits you will actually keep',
       'Set the limit as a number of trades, not a sum of money. Three losses in a session and you stop, whatever the balance says. A number of trades is countable in the moment; a percentage is something you argue with. Write it down before the session, because the version of you who has just lost twice is not the one who should be setting it.'],
      ['The journal that does the work',
       'Record four things per trade: the market, the reason, the duration, and what you felt. Not the result; the platform already has that. After thirty trades you will be able to sort by reason and see which of your setups actually pays, and which ones only feel like trading.']
    ]
  },
  {
    file: 'orbisflow-professional-intro',
    course: 'Professional',
    title: 'Building a trading system',
    lead: 'A system is a set of rules you can test, follow and improve without renegotiating them mid-session. This is how one gets built, and how you know when it is finished.',
    sections: [
      ['What counts as a system',
       'A system answers, in advance: which market, at what time, on what signal, at what stake, for how long, and when you stop for the day. If a question can only be answered in the moment, it is not a rule, it is a mood. Write the six answers on one page. If they do not fit on one page, the system is not finished, it is a collection of opinions.'],
      ['Testing before funding',
       'Run the rules over past data first, then forward on demo for at least fifty trades. You are looking for three numbers: the strike rate, the longest losing run, and the largest drawdown. If the longest losing run in testing would have frightened you, it will end you live, because live runs are always longer than the tested sample.'],
      ['Drawdown control',
       'Every system has a bad month. Decide in advance what a bad month looks like, in per cent, and what you do when it arrives: halve the stake, not the rules. Traders who change the rules in a drawdown discover afterwards that they abandoned a working system at exactly the point it would have recovered.'],
      ['Reviewing without rewriting',
       'Review weekly, change quarterly. A weekly review reads the journal and marks which trades broke the rules; a quarterly review is the only time the rules may change, and only on evidence from at least a hundred trades. This is the discipline that separates a professional routine from an expensive hobby.']
    ]
  }
];

const page = c => `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm 17mm 16mm; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:"Inter","Helvetica Neue",Arial,sans-serif; color:#1C1C1C;
        font-size:10.5pt; line-height:1.62; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .brand{ display:flex; align-items:baseline; justify-content:space-between;
          border-bottom:1.5px solid #1C1C1C; padding-bottom:7px; margin-bottom:26px; }
  .word{ font-family:"Poppins","Inter",sans-serif; font-weight:700; font-size:14pt; letter-spacing:-.02em; }
  .word i{ font-style:normal; color:#00994F; }
  .kicker{ font-size:7.5pt; letter-spacing:.16em; text-transform:uppercase; color:#6B6A64; }
  h1{ font-size:23pt; line-height:1.15; letter-spacing:-.025em; margin:0 0 12px; }
  .lead{ font-size:11.5pt; line-height:1.55; color:#3D3C37; margin:0 0 30px; max-width:52ch; }
  h2{ font-size:11pt; margin:26px 0 7px; letter-spacing:-.01em; }
  h2::before{ content:""; display:block; width:26px; height:2px; background:#00994F; margin-bottom:9px; }
  p{ margin:0; max-width:64ch; }
  .foot{ position:fixed; bottom:-9mm; left:0; right:0; display:flex; justify-content:space-between;
         font-size:7.5pt; color:#93928C; border-top:1px solid #E2E0DA; padding-top:5px; }
  .end{ margin-top:32px; padding:13px 15px; background:#F5F4F0; border-left:2px solid #00994F; }
  .end b{ display:block; margin-bottom:3px; font-size:10pt; }
  .end span{ font-size:9.5pt; color:#3D3C37; }
</style></head><body>
  <div class="brand"><span class="word">orbis<i>flow</i></span>
    <span class="kicker">${c.course} &middot; free introduction</span></div>
  <h1>${c.title}</h1>
  <p class="lead">${c.lead}</p>
  ${c.sections.map(s => `<h2>${s[0]}</h2><p>${s[1]}</p>`).join('')}
  <div class="end"><b>This is the introduction, not the course.</b>
    <span>The full ${c.course} course carries the lessons, the worked examples and the
    templates referenced here. It is on the Academy page at orbisflow.com/academy.</span></div>
  <div class="foot"><span>orbisflow Academy &middot; ${c.course}</span><span>orbisflow.com/academy</span></div>
</body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  for (const c of COURSES) {
    const p = await b.newPage();
    await p.setContent(page(c), { waitUntil: 'networkidle0' });
    const path = `${OUT}/${c.file}.pdf`;
    await p.pdf({ path, format: 'A4', printBackground: true });
    console.log(c.file + '.pdf', (fs.statSync(path).size / 1024).toFixed(1) + ' KB');
    await p.close();
  }
  await b.close();
})();
