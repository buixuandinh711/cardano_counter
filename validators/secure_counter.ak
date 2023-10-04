use aiken/list
use aiken/transaction.{InlineDatum, Output, ScriptContext, Spend, Transaction}
use aiken/transaction/value.{PolicyId}
use utils.{CounterDatum, auth_token_name}

validator {
  fn increase_counter(
    _datum: CounterDatum,
    _redeemer: Void,
    context: ScriptContext,
  ) -> Bool {
    // Destruct input 
    let ScriptContext { transaction, purpose } = context
    expect Spend(spent_utxo_reference) = purpose

    let Transaction { inputs, outputs, extra_signatories, .. } = transaction
    expect Some(input) = inputs |> transaction.find_input(spent_utxo_reference)
    let script_address = input.output.address

    //--------------------------------Has 1 counter input only-------------------------------
    let input_counter_num =
      inputs |> list.count(fn(in) { in.output.address == script_address })
    expect input_counter_num == 1

    expect InlineDatum(old_datum) = input.output.datum
    expect old_counter_datum: CounterDatum = old_datum
    let auth_token_policy_id = old_counter_datum.auth_token_policy_id

    //--------------------------------Input has auth token-------------------------------
    expect has_auth_token(input.output, auth_token_policy_id)

    //--------------------------------Has 1 counter output only-------------------------------
    let counter_outputs =
      outputs |> list.filter(fn(output) { output.address == script_address })
    expect list.length(counter_outputs) == 1

    //--------------------------------Output has auth token-------------------------------
    expect Some(output) = counter_outputs |> list.head()
    expect has_auth_token(output, auth_token_policy_id)

    //--------------------------------Output updated correctly-------------------------------
    expect InlineDatum(new_datum) = output.datum
    expect new_counter_datum: CounterDatum = new_datum

    expect and {
        new_counter_datum.counter == old_counter_datum.counter + 1,
        new_counter_datum.owner == old_counter_datum.owner,
        new_counter_datum.auth_token_policy_id == auth_token_policy_id,
        list.has(extra_signatories, old_counter_datum.owner),
      }

    True
  }
}

fn has_auth_token(output: Output, policy_id: PolicyId) -> Bool {
  let auth_token_num =
    output.value
      |> value.quantity_of(policy_id, auth_token_name)
  auth_token_num == 1
}
