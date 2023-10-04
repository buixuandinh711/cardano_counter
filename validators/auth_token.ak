use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/transaction.{InlineDatum, Mint, ScriptContext, Transaction}
use aiken/transaction/credential.{Script}
use aiken/transaction/value
use utils.{CounterDatum, auth_token_name}

validator(counter_script_hash: Hash<Blake2b_224, Script>) {
  fn create_auth_token(_redeemer: Void, context: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = context
    expect Mint(policy_id) = purpose
    let Transaction { inputs, outputs, extra_signatories, mint, .. } =
      transaction

    //-------------------------------Has no counter in inputs--------------------------------
    let counter_input_num =
      inputs
        |> list.map(fn(input) { input.output })
        |> transaction.find_script_outputs(counter_script_hash)
        |> list.length()
    expect counter_input_num == 0
    //-------------------------------Has valid counter output--------------------------------
    let counter_outputs =
      outputs |> transaction.find_script_outputs(counter_script_hash)
    let has_valid_output =
      counter_outputs
        |> list.all(
             fn(output) {
               expect InlineDatum(inline_datum) = output.datum
               expect counter_datum: CounterDatum = inline_datum
               let auth_token_num =
                 output.value |> value.quantity_of(policy_id, auth_token_name)
               and {
                 counter_datum.counter == 0,
                 counter_datum.auth_token_policy_id == policy_id,
                 list.has(extra_signatories, counter_datum.owner),
                 auth_token_num == 1,
               }
             },
           )
    expect has_valid_output
    //-------------------------------Has minted token == number of counter outputs--------------------------------
    let minted_token_num =
      mint
        |> value.from_minted_value()
        |> value.quantity_of(policy_id, auth_token_name)

    expect minted_token_num == list.length(counter_outputs)
    True
  }
}
