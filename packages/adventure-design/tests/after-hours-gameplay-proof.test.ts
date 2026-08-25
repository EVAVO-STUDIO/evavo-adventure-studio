import { describe, expect, it } from "vitest";
import {
  AFTER_HOURS_MAX_SCORE,
  afterHoursProofComplete,
  bluffAfterHoursHostWithCoat,
  borrowAfterHoursCoat,
  createAfterHoursGameplayState,
  enterAfterHoursPenthouseSocially,
  enterAfterHoursPenthouseViaService,
  findAfterHoursReceipt,
  makeAwkwardBartenderIntroduction,
  noticeAfterHoursServiceCart,
  payAfterHoursTab,
  tradeAfterHoursCameraFavour,
} from "../src/after-hours-gameplay-proof.js";

describe("After Hours Sierra social-comedy proof", () => {
  it("makes an awkward introduction consequential but recoverable", () => {
    let state = createAfterHoursGameplayState();
    const awkward = makeAwkwardBartenderIntroduction(state);
    expect(awkward.embarrassment).toBe(true);
    expect(awkward.state.bartender).toBe("amused");
    expect(awkward.state.serviceRouteOpen).toBe(false);
    expect(awkward.state.embarrassmentCount).toBe(1);
    state = payAfterHoursTab(awkward.state).state;
    expect(state.bartender).toBe("helpful");
    expect(state.serviceRouteOpen).toBe(true);
  });

  it("supports a non-cash lounge solution with a distinct fictional cost", () => {
    const paid = payAfterHoursTab(createAfterHoursGameplayState()).state;
    const favour = tradeAfterHoursCameraFavour(createAfterHoursGameplayState()).state;
    expect(paid.serviceRouteOpen).toBe(true);
    expect(favour.serviceRouteOpen).toBe(true);
    expect(paid.money).toBe(6);
    expect(favour.money).toBe(18);
    expect(favour.spareFlashAvailable).toBe(false);
    expect(paid.score).toBe(favour.score);
  });

  it("makes a bad coat bluff funny and specific without permanently poisoning the host route", () => {
    let state = createAfterHoursGameplayState();
    state = borrowAfterHoursCoat(state).state;
    const badBluff = bluffAfterHoursHostWithCoat(state);
    expect(badBluff.embarrassment).toBe(true);
    expect(badBluff.state.host).toBe("suspicious");
    expect(badBluff.state.penthouseLeadKnown).toBe(false);
    expect(badBluff.feedback).toMatch(/very much not the keynote speaker/iu);

    state = findAfterHoursReceipt(badBluff.state).state;
    state = bluffAfterHoursHostWithCoat(state).state;
    expect(state.host).toBe("helpful");
    expect(state.penthouseLeadKnown).toBe(true);
  });

  it("supports a social final route built from conversation plus physical context", () => {
    let state = createAfterHoursGameplayState();
    state = borrowAfterHoursCoat(state).state;
    state = findAfterHoursReceipt(state).state;
    state = bluffAfterHoursHostWithCoat(state).state;
    state = enterAfterHoursPenthouseSocially(state).state;
    expect(state.finalAccess).toBe("social");
    expect(afterHoursProofComplete(state)).toBe(true);
    expect(state.score).toBe(14);
  });

  it("supports an independent service final route rather than one obscure mandatory solution", () => {
    let state = createAfterHoursGameplayState();
    state = tradeAfterHoursCameraFavour(state).state;
    state = noticeAfterHoursServiceCart(state).state;
    state = enterAfterHoursPenthouseViaService(state).state;
    expect(state.finalAccess).toBe("service");
    expect(afterHoursProofComplete(state)).toBe(true);
    expect(state.penthouseLeadKnown).toBe(false);
    expect(state.score).toBe(10);
  });

  it("keeps score one-shot and exposes the complete-route maximum", () => {
    let state = createAfterHoursGameplayState();
    state = payAfterHoursTab(state).state;
    state = payAfterHoursTab(state).state;
    state = borrowAfterHoursCoat(state).state;
    state = findAfterHoursReceipt(state).state;
    state = findAfterHoursReceipt(state).state;
    state = bluffAfterHoursHostWithCoat(state).state;
    state = enterAfterHoursPenthouseSocially(state).state;
    expect(state.score).toBe(AFTER_HOURS_MAX_SCORE);
    expect(state.awardedScoreIds).toHaveLength(4);
  });
});
