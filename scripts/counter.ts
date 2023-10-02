import { Lucid, Data, Emulator } from "lucid";
import { decodeDatum, generateKeys, readValidator } from "./utils.ts";

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
const validator = await readValidator("../plutus.json", 0);
const contractAddress = lucid.utils.validatorToAddress(validator);

/* ------------------------------------------Create datum------------------------------- */
const CounterDatumSchema = Data.Object({
  owner: Data.Bytes(),
  counter: Data.Integer(),
});
type CounterDatum = Data.Static<typeof CounterDatumSchema>;
const CounterDatum = CounterDatumSchema as unknown as CounterDatum;

const publicKeyHash = lucid.utils.getAddressDetails(
  await lucid.wallet.address()
).paymentCredential!.hash;
const counter = 0n;

const initDatum: CounterDatum = {
  owner: publicKeyHash,
  counter,
};

/* ------------------------------------------Create and submit init UTXO------------------------------- */
const createCounterTx = await lucid
  .newTx()
  .payToContract(
    contractAddress,
    { inline: Data.to(initDatum, CounterDatum) },
    {}
  )
  .complete();
const signedCreateCounterTx = await createCounterTx.sign().complete();
const createCounterTxHash = await signedCreateCounterTx.submit();
await lucid.awaitTx(createCounterTxHash);
console.log("Successfully create init UTXO");
/* ------------------------------------------Decode init UTXO datum------------------------------- */
const contractDatum = await lucid.utxosAt(contractAddress);
const createdCounterUtxo = contractDatum.find(
  (datum) => datum.txHash === createCounterTxHash
)!;
const createdCounterDatum = createdCounterUtxo.datum!;
console.log("Created counter datum:", decodeDatum(createdCounterDatum));

/* ------------------------------------------Create and submit update UTXO------------------------------- */
const updateDatum: CounterDatum = {
  ...initDatum,
  counter: initDatum.counter + 1n,
};
const updateTx = await lucid
  .newTx()
  .collectFrom([createdCounterUtxo], Data.void())
  .attachSpendingValidator(validator)
  .payToContract(
    contractAddress,
    { inline: Data.to(updateDatum, CounterDatum) },
    {}
  )
  .payToContract(
    contractAddress,
    {
      inline: Data.to(
        {
          ...initDatum,
          counter: initDatum.counter + 1000n,
        },
        CounterDatum
      ),
    },
    {}
  )
  .addSigner(ownerAddress)
  .complete();
const signedUpdateTx = await updateTx.sign().complete();
const updateTxHash = await signedUpdateTx.submit();
await lucid.awaitTx(updateTxHash);
console.log("Successfully create update UTXO");

const updatedContractDatum = await lucid.utxosAt(contractAddress);
const updatedUtxo = updatedContractDatum.find(
  (datum) => datum.txHash === updateTxHash
)!;
console.log("Updated Datum: ", decodeDatum(updatedUtxo.datum!));
