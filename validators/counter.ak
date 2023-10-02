use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/transaction.{InlineDatum, ScriptContext, Spend, find_input}
use aiken/transaction/credential.{VerificationKey}

type CounterDatum {
  owner: Hash<Blake2b_224, VerificationKey>,
  counter: Int,
}

validator {
  fn increase_counter(_datum: CounterDatum, _redeemer: Void, context: ScriptContext) -> Bool {
    // Destruct input 
    let ScriptContext { transaction, purpose } = context
    expect Spend(spent_utxo_reference) = purpose
    expect Some(input) = find_input(transaction.inputs, spent_utxo_reference)

    // Get input datum and script addresss
    expect InlineDatum(maybe_old_count_datum) = input.output.datum
    expect old_count_datum: CounterDatum = maybe_old_count_datum
    let count_script_address = input.output.address

    // Get output datum, only concern the first found output
    expect Some(output) =
      transaction.outputs
        |> list.filter(fn(output) { output.address == count_script_address })
        |> list.head()
    expect InlineDatum(maybe_new_count_datumn) = output.datum
    expect new_count_datum: CounterDatum = maybe_new_count_datumn

    // return result = "must signed by owner" + "counter must be increased by 1" + "owner is remained"
    and {
      list.has(transaction.extra_signatories, old_count_datum.owner),
      new_count_datum.counter == old_count_datum.counter + 1,
      new_count_datum.owner == old_count_datum.owner,
    }
  }
}
