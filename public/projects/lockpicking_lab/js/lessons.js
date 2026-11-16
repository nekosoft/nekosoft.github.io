/*
 * Lesson content. Poster text is reproduced from the festival posters; the
 * "physics" sections explain what the simulation is computing, following the
 * MIT Guide to Lock Picking (Ted the Tool, 1991):
 *   ch. 2 How a Key Opens a Lock, ch. 3 The Flatland Model,
 *   ch. 4 Basic Picking & The Binding Defect, ch. 5 The Pin Column Model,
 *   ch. 9 Recognizing and Exploiting Personality Traits (9.9 mushroom drivers).
 *
 * Step scripts drive the same controls a visitor uses. Each action eases the
 * named controls to their targets over `dur` seconds:
 *   tension (0..1), db (driver-bottom height to lift to; 'rest' lowers the pick),
 *   insert (key 0..1), dial (number, with dir +1 right / -1 left, turns),
 *   shackle (0..1), shim (0..1), pull (0..1), wait.
 */
(function (root) {
  'use strict';

  const SAFETY = 'ONLY PICK LOCKS YOU OWN OR HAVE EXPLICIT PERMISSION TO PICK.';
  const SAFETY2 = 'Use a practice lock, rather than one you rely on to keep something secure.';
  const PIN_REFS = 'References: MIT Guide to Lock Picking, chapters 4-5 and 9.9; Lockwiki, Security pin.';
  const SIDE_NOTE = 'Side view. The plug\'s turn is shown as a sideways shift, and the gaps and tilt are drawn bigger than they really are.';
  const LEGEND_PIN = [['var(--mustard)', 'Driver pin'], ['var(--teal)', 'Key pin'], ['var(--rose)', 'Shear line'], ['var(--teal-soft)', 'Rotating plug']];

  const PHYS_BINDING = `
    <p><b>Why only one pin binds (MIT ch. 3-4).</b> The holes drilled in the plug never line up perfectly with the holes in the housing. Each stack in this lock has its own small offset. Turn the plug and it rotates until the stack with the largest offset is pinched at the shear line. That pin is the <i>binding pin</i>; the others are still loose.</p>
    <p><b>What you feel (MIT ch. 5).</b> To lift a pin the pick must overcome the spring, and for the binding pin also friction:</p>
    <p class="eq">F<sub>lift</sub> ≈ k·x + μ·N</p>
    <p>Here <i>k·x</i> is the spring, <i>μ</i> is the friction coefficient and <i>N</i> is the sideways force from your tension. More tension means more friction and a stiffer pin. When the split reaches the shear line the plug turns a little until the <i>next</i> stack binds. Push further and the key pin crosses the line: an overset.</p>`;

  const PHYS_ENGINE = `
    <p><b>How the simulation works.</b> Every part is a rigid body made of convex polygons. A position-based dynamics solver (XPBD) resolves contacts 24 times per frame with Coulomb friction (μ ≈ 0.22, lubricated brass). Nothing here is scripted. Binding, setting, false sets and counter-rotation all come from the shapes, the springs and your two forces: tension on the plug and lift from the pick.</p>`;

  function pinLesson(o) {
    return Object.assign({
      kind: 'pin', kicker: 'MEET THE LOCK', legend: LEGEND_PIN, note: SIDE_NOTE, refs: PIN_REFS,
    }, o);
  }

  const LESSONS = [
    // ------------------------------------------------------------ basics
    {
      id: 'how', kind: 'key', kicker: 'LOCKSPORT  /  THE BASICS', num: '01 / 03',
      title: 'How a pin-tumbler lock works',
      subtitle: 'The right key lifts the pins just far enough for the plug to turn.',
      scene: { mode: 'key', pins: [62, 48, 70, 55, 66].map(k => ({ type: 'standard', keyLen: k, offset: 0 })) },
      steps: [
        { title: 'No key', caption: 'Springs push each stack down. The driver pins sit across the shear line, so the plug won\'t turn.', run: [{ insert: 0, dur: 0.4 }, { turn: true, dur: 1 }] },
        { title: 'Key going in', caption: 'The slopes on the key push each pin up as it slides underneath.', run: [{ insert: 0.55, dur: 2 }] },
        { title: 'Correct key inserted', caption: 'Every gap between key pin and driver lines up with the shear line, so the plug turns.', run: [{ insert: 1, dur: 1.6 }, { wait: 0.4 }, { turn: true, dur: 1.2 }] },
      ],
      cards: [
        { n: '01', color: 'var(--teal)', title: 'Key pins', text: 'They rest on the key. Each one is a different length to match a cut.' },
        { n: '02', color: 'var(--mustard)', title: 'Driver pins', text: 'They sit on top of the key pins. One driver across the shear line is enough to stop the plug.' },
        { n: '03', color: 'var(--muted)', title: 'Springs', text: 'They push the pins down onto the key.' },
        { n: '04', color: 'var(--rose)', title: 'Shear line', text: 'The gap between the plug and the housing. For the plug to turn, nothing can be across it.' },
      ],
      physics: `
        <p><b>What the key does (MIT ch. 2).</b> Each cut on the key sits at exactly the depth that puts the top of its key pin level with the shear line. The plug turns only if every split lines up at once. Try the wrong key, or edit the cuts, and see which stacks block.</p>
        <p>The key here is a kinematic body: it moves where you put it, whatever the force. The pins are dynamic and ride up its ramps against their springs. The panel on the right shows how far each split is from the shear line.</p>${PHYS_ENGINE}`,
      note: 'Simplified side cutaway; pins shown above the key. The round inset shows the plug from the front.',
      refs: 'Source: MIT Guide to Lock Picking, chapter 2.',
    },
    {
      id: 'meet', kind: 'gallery', kicker: 'LOCKPICKING BASICS', num: '02 / 03',
      title: 'Meet the lock',
      subtitle: 'The pins, what they do, and what to feel for.',
      intro: 'The pick pushes up the key pin, and the key pin pushes up the driver. These are the driver shapes you\'ll come across. The waists and grooves are there to fool you.',
      rows: [
        { type: 'standard', lesson: 'standard', how: 'Straight sides. It blocks the plug until its bottom edge is above the shear line.', feel: 'Stiff at first, then a small give or click when it sets.', helps: 'Lift it gently and stop once it sets. Go further and you overset it.' },
        { type: 'spool', lesson: 'spool', how: 'Thin in the middle, wide at both ends. The plug turns into the waist, then the wide end stops it.', feel: 'A false set. Lift the stuck pin and the plug pushes back against your wrench.', helps: 'Go lighter on the wrench so the plug can turn back as you lift.' },
        { type: 'serrated', lesson: 'serrated', how: 'Rows of small grooves that snag at the shear line before the pin is really set.', feel: 'Lots of little clicks. Most of them are just grooves.', helps: 'Lift in small steps. After each click, check whether the pin feels stiff.' },
        { type: 'mushroom', lesson: 'mushroom', how: 'A sloped shoulder that wedges at the shear line as the pin tilts.', feel: 'A false set, then the plug slowly creeps backwards as you lift.', helps: 'Let the plug creep back while the shoulder slides past. Don\'t force it.' },
        { type: 'hybrid', lesson: 'hybrid', how: 'A spool waist with grooves cut into it.', feel: 'Small clicks first, then a false set and the plug turning back.', helps: 'Deal with one catch at a time. The feel changes as the pin goes up.' },
      ],
      note: 'What you feel depends on the lock, your tension and where the pin is. Hearing a click doesn\'t mean a pin has set.',
      refs: 'Sources: MIT Guide to Lock Picking, chapters 4-5 and 9.9; Lockwiki, Security pin. Shapes exaggerated.',
    },
    pinLesson({
      id: 'falseset', kicker: 'LOCKPICKING BASICS', num: '03 / 03',
      title: 'What is a false set?',
      subtitle: 'The plug turns a little, but one security pin is caught.',
      scene: { pins: [{ type: 'spool', keyLen: 40, offset: 0 }] }, annotate: true,
      steps: [
        { title: 'Before', caption: 'The pin\'s full width is across the line.', run: [{ tension: 0.5, dur: 0.6 }, { db: 'touch', dur: 0.6 }] },
        { title: 'False set', caption: 'The waist lets the plug turn, then the edge catches.', run: [{ db: 30, dur: 1.6 }] },
        { title: 'After clearing', caption: 'With the edge past, this stack lets the plug turn further.', run: [{ tension: 0.18, dur: 0.6 }, { db: -0.8, dur: 3.2 }, { tension: 0.5, dur: 0.4 }, { db: 'rest', dur: 0.8 }] },
      ],
      feel: 'The plug turns a little and stops. When you lift the stuck pin, the plug tries to turn back. This backward push is called counter-rotation.',
      helps: 'Relax your grip on the wrench and let the plug turn back as the pin rises.',
      remember: 'This is one pin stack. The lock only opens once every stack, and anything else holding it, lets go.',
      physics: `
        <p><b>Where the catch is.</b> Once the waist is at the shear line the plug can turn further, by about the waist depth, before metal meets metal. The pin tilts: its top end stays in the housing and its bottom flange rides along in the plug. The ringed corner is where the bottom flange's chamfer meets the edge of the plug hole.</p>
        <p><b>Counter-rotation (MIT 9.9).</b> Lifting now pushes that chamfer into the plug's edge. A sloped contact turns part of your lift into a sideways push that rotates the plug <i>backwards</i>. The pin can only rise if that push beats your tension, roughly:</p>
        <p class="eq">F<sub>lift</sub> · (1 − μ)/(1 + μ) &gt; F<sub>tension</sub></p>
        <p>At 50% tension the pick runs out of force and jams. Ease to about 20% and the plug rolls back and the pin sets. Try both.</p>${PHYS_ENGINE}`,
      refs: 'Sources: MIT Guide to Lock Picking, section 9.9; Lockwiki, Security pin. Diagram shows one pin stack.',
      note: 'Side view. The tilt and the offset between the holes are drawn bigger so you can see the catch.',
    }),
    // ------------------------------------------------------- meet the lock
    pinLesson({
      id: 'standard', num: '01 / 06', title: 'Standard pin',
      subtitle: 'Straight sides. A useful place to learn what binding and setting feel like.',
      scene: { pins: [{ type: 'standard', keyLen: 62, offset: 0 }] },
      steps: [
        { title: 'Blocking', caption: 'The driver sits across the line, so the plug can\'t turn.', run: [{ tension: 0.5, dur: 0.6 }, { db: 'touch', dur: 0.6 }] },
        { title: 'Nearly there', caption: 'Lifting brings the driver up towards the line.', run: [{ db: 8, dur: 1.8 }] },
        { title: 'Set', caption: 'The driver is above the line and the plug slides under it.', run: [{ db: -0.8, dur: 1.6 }, { wait: 0.3 }, { db: 'rest', dur: 0.8 }] },
      ],
      feel: 'The binding pin feels stiff. When it sets you might feel a small click, or the plug give slightly.',
      helps: 'Lift gently and stop as soon as it sets. Keep pushing and the key pin goes past the line instead, which is called an overset.',
      remember: 'What matters is the gap between key pin and driver reaching the shear line. A click on its own proves nothing.',
      physics: PHYS_BINDING + PHYS_ENGINE,
    }),
    pinLesson({
      id: 'spool', num: '02 / 06', title: 'Spool pin',
      subtitle: 'A narrow waist lets the plug turn a little. The wide end still gets in the way.',
      scene: { pins: [{ type: 'spool', keyLen: 40, offset: 0 }] },
      steps: [
        { title: 'Blocking', caption: 'The wide end is across the line.', run: [{ tension: 0.5, dur: 0.6 }, { db: 'touch', dur: 0.6 }] },
        { title: 'False set', caption: 'The waist lets the plug turn, until the rim catches.', run: [{ db: 30, dur: 1.6 }] },
        { title: 'Set', caption: 'Once the rim is past the line, nothing is in the way.', run: [{ tension: 0.18, dur: 0.6 }, { db: -0.8, dur: 3.2 }, { tension: 0.5, dur: 0.4 }, { db: 'rest', dur: 0.8 }] },
      ],
      feel: 'The plug turns a bit and then stops. That\'s a false set. Lift the stuck pin and the plug pushes back.',
      helps: 'Ease off the tension so the plug can turn back while you lift. This is called counter-rotation.',
      remember: 'A false set is not an open lock. One wide end is caught on the edge of the hole.',
      physics: `<p><b>Try it.</b> Get to the false set, then keep lifting at 50% tension. The pick force saturates on the graph and the pin will not move. Drop the tension slider to around 20% and lift again: watch the plug roll back as the flange slides past the edge.</p>` + PHYS_BINDING + PHYS_ENGINE,
    }),
    pinLesson({
      id: 'serrated', num: '03 / 06', title: 'Serrated pin',
      subtitle: 'The grooves make it feel like you\'re getting somewhere when you aren\'t.',
      scene: { pins: [{ type: 'serrated', keyLen: 40, offset: 0 }] },
      steps: [
        { title: 'Blocking', caption: 'The driver is across the shear line.', run: [{ tension: 0.45, dur: 0.6 }, { db: 'touch', dur: 0.6 }] },
        { title: 'Groove catches', caption: 'An edge drops into a groove. It feels like a set, but it isn\'t.', run: [{ db: 24, dur: 4 }] },
        { title: 'Set', caption: 'At last the bottom of the driver is above the line.', run: [{ tension: 0.3, dur: 0.4 }, { db: -0.8, dur: 3.5 }, { tension: 0.5, dur: 0.4 }, { db: 'rest', dur: 0.8 }] },
      ],
      feel: 'Lots of small clicks as you lift. A groove catching feels a lot like a pin setting.',
      helps: 'Lift a little at a time. After each click, check whether the pin is stiff. If it is, keep going.',
      remember: 'Counting clicks won\'t help. Groove depth, how hard you turn and the lock itself all change what you feel.',
      physics: `<p><b>Watch the feel graph.</b> Each groove leaves a spike in pick force and a tiny jump in plug rotation as an edge drops in and out. Count them, then notice that none of them is the set. The set is the moment the plug moves and the force falls away.</p>` + PHYS_BINDING + PHYS_ENGINE,
    }),
    pinLesson({
      id: 'mushroom', num: '04 / 06', title: 'Mushroom pin',
      subtitle: 'A tapered shoulder can wedge at the shear line as the plug starts to turn.',
      scene: { pins: [{ type: 'mushroom', keyLen: 40, offset: 0 }] },
      steps: [
        { title: 'Blocking', caption: 'The wide part of the driver is in the plug\'s way.', run: [{ tension: 0.5, dur: 0.6 }, { db: 'touch', dur: 0.6 }] },
        { title: 'Shoulder catches', caption: 'The pin tilts and its sloped shoulder jams on the edge.', run: [{ db: 22, dur: 1.8 }] },
        { title: 'Set', caption: 'The shoulder slides past and the driver is above the line.', run: [{ tension: 0.18, dur: 0.6 }, { db: -0.8, dur: 3.2 }, { tension: 0.5, dur: 0.4 }, { db: 'rest', dur: 0.8 }] },
      ],
      feel: 'Another false set, and the plug creeps backwards as you lift. Because of the slope it feels gradual, not sudden.',
      helps: 'Let the plug creep back as the shoulder slides past. If nothing moves, turn more lightly.',
      remember: 'Every manufacturer shapes these a bit differently. This is one simple version.',
      physics: `<p><b>Mushroom drivers (MIT 9.9).</b> The guide describes the plug turning <i>backwards</i> as the caught pin is lifted, and advises reducing torque so it can. Here the taper is a long, shallow slope, so the counter-rotation is gradual rather than a sudden snap.</p>` + PHYS_BINDING + PHYS_ENGINE,
    }),
    pinLesson({
      id: 'hybrid', num: '05 / 06', title: 'Hybrid pin',
      subtitle: 'One pin can combine a spool waist with serrated edges.',
      scene: { pins: [{ type: 'hybrid', keyLen: 40, offset: 0 }] },
      steps: [
        { title: 'Groove catches', caption: 'A groove catches before the waist gets to the line.', run: [{ tension: 0.45, dur: 0.6 }, { db: 'touch', dur: 0.5 }, { db: 44, dur: 1.4 }] },
        { title: 'Waist catches', caption: 'The waist gives a false set, but the wide end is stuck.', run: [{ db: 28, dur: 1.6 }] },
        { title: 'Set', caption: 'The whole driver is above the shear line.', run: [{ tension: 0.18, dur: 0.6 }, { db: -0.8, dur: 3.2 }, { tension: 0.5, dur: 0.4 }, { db: 'rest', dur: 0.8 }] },
      ],
      feel: 'A bit of everything. Small clicks first, then a false set and the plug turning back. Which comes first depends on the pin.',
      helps: 'Take each catch as it comes. Lift in small steps and let the plug turn back when it wants to.',
      remember: 'This is just one spool-and-groove design. Other hybrids won\'t go in the same order.',
      physics: PHYS_BINDING + PHYS_ENGINE,
    }),
    // ------------------------------------------------ other mechanisms
    {
      id: 'combo', kind: 'combo', kicker: 'MEET THE LOCK', num: '01 / 02',
      title: 'Round-dial combination lock',
      subtitle: 'Turning the dial positions hidden wheels. Their gates must line up.',
      intro: 'As you turn the dial it picks up the wheels one after another. Reversing direction lets you move one wheel without disturbing the last one. The wheels are drawn apart so you can see every gate.',
      scene: { combo: [30, 12, 26] },
      steps: [
        { title: 'Not aligned', caption: 'The fence hits solid metal on the wheels, so the latch stays locked.', run: [{ shackle: 0.6, dur: 0.6 }, { wait: 0.6 }, { shackle: 0, dur: 0.3 }] },
        { title: 'Partly aligned', caption: 'Two gates line up, but the third wheel is in the way.', run: [{ dialSeq: 2, dur: 7 }, { shackle: 0.6, dur: 0.6 }, { wait: 0.6 }, { shackle: 0, dur: 0.3 }] },
        { title: 'All aligned', caption: 'The fence drops into all three gates and the latch can release.', run: [{ dialSeq: 3, dur: 2.5 }, { shackle: 0.8, dur: 0.8 }] },
      ],
      feel: 'On some locks, pulling lightly on the shackle makes the dial feel heavier in places. That alone won\'t tell you the right number.',
      helpsLabel: 'TRY IT ON A PRACTICE LOCK',
      helps: 'Dial a combination you already know and watch what happens. Which way to turn, and how many times, depends on the model.',
      remember: 'There\'s no shear line here, just gates in the wheels. The layout inside and the way the latch releases differ from lock to lock.',
      physics: `
        <p><b>Lost motion.</b> The dial's drive cam picks up wheel 3 almost straight away. Each wheel carries a drive pin, and a wheel only picks up its neighbour once it has turned nearly a full revolution and the pins meet. That is why the usual sequence (right several turns, left past the second number once, then right) can set each wheel without disturbing the one before it. In the sim these couplings are angle-limit constraints between the bodies.</p>
        <p><b>The fence.</b> Shackle tension presses the fence against the wheel rims. That contact has friction, which is the drag you feel in the dial. When every gate is under the fence it drops in and the latch can release.</p>${PHYS_ENGINE}`,
      note: 'Generic wheel-and-fence mechanism, not a specific model. Wheels drawn side by side; in a real lock they are stacked on one axle.',
      refs: 'References: Master Lock, patent WO2008089230; Lockwiki, Combination.',
    },
    {
      id: 'shim', kind: 'shim', kicker: 'MEET THE LOCK', num: '02 / 02',
      title: 'The shim and the latch',
      subtitle: 'A thin metal shim can push back an accessible spring-loaded latch.',
      intro: 'The latch sits in a notch in the shackle and a spring keeps it there. On some padlocks a thin shim can reach the sloped face of the latch and push it out of the notch.',
      scene: {},
      steps: [
        { title: 'Latched', caption: 'The spring holds the latch in the notch, so the shackle can\'t lift.', run: [{ pull: 0.7, dur: 0.6 }, { wait: 0.6 }, { pull: 0, dur: 0.3 }] },
        { title: 'Latch pushed back', caption: 'The shim slides down the slope and pushes the latch back against its spring.', run: [{ shim: 1, dur: 2.2 }] },
        { title: 'Shackle lifts', caption: 'With the latch held out of the way, the notch slides past it.', run: [{ pull: 1, dur: 0.8 }] },
      ],
      feel: 'You can feel the latch give as the spring squashes. If it doesn\'t clear the notch, the shackle catches anyway. It\'s much easier to see on a clear demo lock.',
      helpsLabel: 'WHY IT CAN FAIL',
      helps: 'There might be a shield over the latch, no room for a shim, or a latch on both legs. Padlocks that lock with ball bearings won\'t open this way at all.',
      remember: 'The dial and wheels never move. Shimming gets round the combination, it doesn\'t find it.',
      physics: `
        <p><b>A wedge.</b> The latch's top face is sloped. The shim can only move straight down, so contact with that slope turns its downward push into a sideways push on the latch, against the latch spring (Hooke's law, F = k·x). The underside of the latch is flat, which is why pulling the shackle alone does nothing: that contact pushes straight down and has no sideways part.</p>
        <p>Switch on <i>shielded latch</i> or <i>deadlocked latch</i> below to see the two defences from the poster.</p>${PHYS_ENGINE}`,
      note: 'One latch design shown. Lots of padlocks are built differently.',
      refs: 'Reference: Zieh-Fix, Padlock Shim Pack.',
    },
    // ---------------------------------------------------------- practice
    {
      id: 'challenge', kind: 'pin', kicker: 'PRACTICE', num: 'LAB',
      title: 'Five-pin practice lock',
      subtitle: 'Find the binding pin, set it, find the next. The order comes from tiny manufacturing errors.',
      legend: LEGEND_PIN, challenge: true,
      scene: null, // generated
      steps: [],
      feel: 'Only one pin feels stiff at a time. When it sets the plug gives slightly, and a different pin becomes stiff.',
      helps: 'Use light tension. Test each pin with a gentle lift and look for the one that resists. Turn on blind mode and rely on the feel graph alone.',
      remember: 'If the plug turns back or nothing binds, release tension and start again. Pins that dropped need attention again.',
      physics: `
        <p><b>The binding defect (MIT ch. 4).</b> Each plug hole in this lock is offset by a random fraction of the clearance. Switch on <i>show offsets</i> to see them. The pin that binds first is the one with the largest offset, then the next, and so on. The lock forces this order. You are not choosing it.</p>
        <p><b>Scrubbing (MIT ch. 6)</b> exploits this: sweep the pick over all the pins with light tension. Pins that aren't binding just bounce, and the binding one sets.</p>` + PHYS_BINDING + PHYS_ENGINE,
      note: 'Side view; plug rotation shown as sideways offset. Offsets and clearances exaggerated.',
      refs: PIN_REFS,
    },
  ];

  const NAV = [
    { group: 'Locksport / the basics', items: ['how', 'meet', 'falseset'] },
    { group: 'Meet the lock: pins', items: ['standard', 'spool', 'serrated', 'mushroom', 'hybrid', ['falseset', '06 What is a false set?']] },
    { group: 'Meet the lock: other locks', items: ['combo', 'shim'] },
    { group: 'Practice', items: ['challenge'] },
  ];

  root.Lessons = { LESSONS, NAV, SAFETY, SAFETY2 };
})(typeof window !== 'undefined' ? window : globalThis);
