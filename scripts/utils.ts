import { C, Lucid, SpendingValidator, Tx, fromHex, toHex } from "lucid";
import { encode } from "cbor";

export async function readValidator(
  path: string,
  index: number
): Promise<SpendingValidator> {
  const validator = JSON.parse(await Deno.readTextFile(path)).validators[index];
  return {
    type: "PlutusV2",
    script: toHex(encode(fromHex(validator.compiledCode))),
  };
}

export async function generateKeys(): Promise<string[]> {
  const lucid = await Lucid.new(undefined, "Preview");

  const privateKey = lucid.utils.generatePrivateKey();

  const address = await lucid
    .selectWalletFromPrivateKey(privateKey)
    .wallet.address();

  return [privateKey, address];
}

export function decodeDatum(scriptDatum: string): string {
  return C.decode_plutus_datum_to_json_str(
    C.PlutusData.from_bytes(fromHex(scriptDatum)),
    C.PlutusDatumSchema.DetailedSchema
  );
}

export async function submitTx(tx: Tx): Promise<string> {
  const completedTx = await tx.complete();
  const signedTx = await completedTx.sign().complete();
  const txHash = await signedTx.submit();
  return txHash;
}
