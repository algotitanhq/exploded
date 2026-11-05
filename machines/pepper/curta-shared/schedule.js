// The film's plan and its operator script. No three.js: the timeline, the score and check.mjs import it in node.
//
// 1 234 × 56 the Curta way: 6 turns in position 1, lift the carriage one notch, 5 turns in position 2 (69 104,
// the counter reads 56). Then the crank pulled up and one turn back in position 2: 69 104 − 12 340 = 56 764 by adding
// the ten's complement, the turn whose carries run from the fourth column off the top. The ring clears it all.
import {createPlan, fromDigits} from './machine.js';

export const DURATION = 38;
export const SETTING = [4, 3, 2, 1, 0, 0, 0, 0]; // 1 234, slider 1 = units

// the plan: every state change, in film seconds
export function filmPlan() {
  const plan = createPlan();
  plan.add({kind: 'slide', t0: 2.4, t1: 4.5, to: SETTING});
  // the first turn in slow motion (the drum's teeth meet the gears one by one), then five at a hand's pace
  plan.add({kind: 'turns', t0: 5.0, t1: 11.0, n: 1, keys: [[0, 0, 0], [0.9, 12], [4.6, 300], [6.0, 360, 0]]});
  plan.add({kind: 'turns', t0: 11.5, t1: 14.6, n: 5});
  plan.add({kind: 'carriage', t0: 15.0, t1: 17.4, to: 2});
  plan.add({kind: 'turns', t0: 17.8, t1: 20.9, n: 5});
  plan.add({kind: 'crank', t0: 21.5, t1: 22.5, up: true});
  // the subtraction: slow through the entry, slower through the carries (θ 150° to 310°), then home
  plan.add({kind: 'turns', t0: 23.0, t1: 29.4, n: 1, keys: [[0, 0, 0], [1.6, 140], [5.4, 312], [6.4, 360, 0]]});
  plan.add({kind: 'crank', t0: 29.7, t1: 30.4, up: false});
  plan.add({kind: 'clear', t0: 30.9, t1: 33.7, to: 1});
  plan.add({kind: 'slide', t0: 34.0, t1: 35.4, to: [0, 0, 0, 0, 0, 0, 0, 0]});
  return plan;
}

// operator moves: a subsystem or a view, clicked on the console; the cut and the explosion follow from it
export const SCRIPT = [
  {t: 0, sub: 'crank'},
  {t: 2.0, sub: 'sliders'},
  {t: 4.6, sub: 'drum'},
  {t: 11.2, sub: 'carriage'},
  {t: 21.1, view: 'axial'},
  {t: 23.9, sub: 'carry'},
  {t: 30.4, sub: 'reset'},
  {t: 34.2, sub: 'crank'},
];
/** the figures the captions quote, read from the plan's own turns */
export function filmFacts(plan) {
  const T = plan.turns;
  const add = T.filter((e) => e.sign > 0);
  const p1 = add.filter((e) => e.p === 1);
  const last = T[T.length - 1];
  const r1 = fromDigits(add[add.length - 1].after);
  return {
    set: fromDigits(SETTING),
    m1: fromDigits(p1[p1.length - 1].ctrAfter),
    m2: fromDigits(add[add.length - 1].ctrAfter),
    r1,
    sub: fromDigits(SETTING) * 10 ** (last.p - 1),
    r2: fromDigits(last.after),
    c2: fromDigits(last.ctrAfter),
  };
}
export const beatAt = (t) => SCRIPT.filter((e) => e.t <= t).pop();
