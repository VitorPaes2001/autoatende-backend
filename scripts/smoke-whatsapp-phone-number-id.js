/**
 * Smoke test simples: valida prioridade phone_number_id e fallback waba_id.
 * Não chama rede real.
 */
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

function resolvePhoneNumberId(account) {
  return account?.phone_number_id || account?.waba_id || null;
}

(function main() {
  const a = resolvePhoneNumberId({ phone_number_id: "PNID", waba_id: "WABA" });
  const b = resolvePhoneNumberId({ waba_id: "WABA_ONLY" });
  const c = resolvePhoneNumberId({});

  assert(a === "PNID", "should prefer phone_number_id");
  assert(b === "WABA_ONLY", "should fallback to waba_id");
  assert(c === null, "should be null when missing");

  console.log("OK: smoke-whatsapp-phone-number-id");
})();
