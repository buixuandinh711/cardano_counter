use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{VerificationKey}
use aiken/transaction/value.{PolicyId}

pub type CounterDatum {
  owner: Hash<Blake2b_224, VerificationKey>,
  counter: Int,
  auth_token_policy_id: PolicyId,
}

pub const auth_token_name = "COUNTER"