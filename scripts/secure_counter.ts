import {
  Lucid,
  Data,
  Emulator,
  applyDoubleCborEncoding,
  applyParamsToScript,
  Script,
  fromText,
} from "lucid";
import { decodeDatum, generateKeys, readValidator, submitTx } from "./utils.ts";

/* ------------------------------------------Setup------------------------------- */
const [ownerPrivateKey, ownerAddress] = await generateKeys();
const emulator = new Emulator([
  {
    address: ownerAddress,
    assets: {
      lovelace: 20000000000n,
    },
  },
]);
const lucid = await Lucid.new(emulator);
lucid.selectWalletFromPrivateKey(ownerPrivateKey);

/* ------------------------------------------Load validator------------------------------- */
const counterValidator = await readValidator("../plutus.json", 1);
const counterScriptHash = lucid.utils.validatorToScriptHash(counterValidator);
const counterContractAddress = lucid.utils.validatorToAddress(counterValidator);

const rawAuthTokenValidator = await readValidator("../plutus.json", 0);
const authTokenValidator = {
  type: "PlutusV2",
  script: applyDoubleCborEncoding(
    applyParamsToScript(rawAuthTokenValidator.script, [counterScriptHash])
  ),
} as Script;
const authTokenPolicyId = lucid.utils.validatorToScriptHash(authTokenValidator);
const AUTH_TOKEN_NAME = "COUNTER";
const authTokenAssetId = authTokenPolicyId + fromText(AUTH_TOKEN_NAME);

const CounterDatumSchema = Data.Object({
  owner: Data.Bytes(),
  counter: Data.Integer(),
  auth_token_policy_id: Data.Bytes(),
});
type CounterDatum = Data.Static<typeof CounterDatumSchema>;
const CounterDatum = CounterDatumSchema as unknown as CounterDatum;

const ownerPublicKeyHash = lucid.utils.getAddressDetails(
  await lucid.wallet.address()
).paymentCredential!.hash;
const counter = 0n;

const createCounterDatum = {
  owner: ownerPublicKeyHash,
  counter,
  auth_token_policy_id: authTokenPolicyId,
};

const mintAuthTokenTx = lucid
  .newTx()
  .attachMintingPolicy(authTokenValidator)
  .mintAssets(
    {
      [authTokenAssetId]: 1n,
    },
    Data.void()
  )
  .payToContract(
    counterContractAddress,
    {
      inline: Data.to(createCounterDatum, CounterDatum),
    },
    {
      [authTokenAssetId]: 1n,
    }
  )
  .addSigner(ownerAddress);
const mintAuthTokenTxHash = await submitTx(mintAuthTokenTx);
await lucid.awaitTx(mintAuthTokenTxHash);
console.log("Counter UTXO created");

const [createdCounterUtxo] = await lucid.utxosAt(counterContractAddress);
console.log(decodeDatum(createdCounterUtxo.datum!));

const updatedCounterDatum = {
  ...createCounterDatum,
  counter: createCounterDatum.counter + 1n,
};

const updateCounterTx = lucid
  .newTx()
  .collectFrom([createdCounterUtxo], Data.void())
  .attachSpendingValidator(counterValidator)
  .payToContract(
    counterContractAddress,
    {
      inline: Data.to(updatedCounterDatum, CounterDatum),
    },
    {
      [authTokenAssetId]: 1n,
    }
  )
  .addSigner(ownerAddress);
const updateCounterTxHash = await submitTx(updateCounterTx);
await lucid.awaitTx(updateCounterTxHash);
console.log("Counter updated");
const [updatedCounterUtxo] = await lucid.utxosAt(counterContractAddress);
console.log(decodeDatum(updatedCounterUtxo.datum!));
