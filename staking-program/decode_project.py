import base64
import struct

data = "zai9yrX3jhMJotLMtRdDa0SGMog0DrHBUwh7f1npSXYZwOTHTz99FX5IN/8M4BRhFuizWTrDzvoQKmC1FyvDw1KnZcBj9grzAAAAAAAAAADrc9kcMRRS/CXIp2eWGNnINPJiHRy/1BtGCrl2r6tXOMX6APhn/w6hUsmVMeNLYWxV8gOL8NG4Ahu31x5JUmFNAZOPg+Nzv6CJgsNCfG3sMtq0vqCp+kVDwDLXehQ+SFWvAQabiFf+q4GE+2h/Y0YYwDXaxDncGus7VZig8AAAAAABACIgSAIAAAAA5AtUAgAAAAAAAAAAAAAAAAAAAAAAAAABNi0AAAAAAAAAAAAAAAAAAAAvDQAAAAAA8uQXaQAAAADyEyVpAAAAAPLkF2kAAAAAAAAAAAAAAAAwHQMAAAAAAL7nF2kAAAAAgIQeAAAAAAAAAAAAAAAAAAAAAAAAAf4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

decoded = base64.b64decode(data)

# Project struct layout (simplified):
# - discriminator: 8 bytes
# - admin: 32 bytes
# - token_mint: 32 bytes
# - pool_id: 8 bytes (u64)
# - total_staked: 8 bytes (u64)
# - reward_rate_per_second: 8 bytes (u64)
# - last_update_time: 8 bytes (i64)
# - reward_per_token_stored: 8 bytes (u64)
# - is_paused: 1 byte
# - reflection_token: 33 bytes (Option<Pubkey>)
# - reflection_vault: 33 bytes (Option<Pubkey>)
# - last_reflection_balance: 8 bytes (u64) <-- This is what we need!

offset = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 33 + 33
last_reflection_balance = struct.unpack_from('<Q', decoded, offset)[0]

print(f"last_reflection_balance (lamports): {last_reflection_balance}")
print(f"last_reflection_balance (SOL): {last_reflection_balance / 1e9}")

# Current vault balance
current_vault = 4039280  # From solana account command
rent_exempt = 2039280  # Approximate rent for token account
usable_balance = current_vault - rent_exempt

print(f"\nCurrent vault (lamports): {current_vault}")
print(f"Usable balance (lamports): {usable_balance}")
print(f"Usable balance (SOL): {usable_balance / 1e9}")
print(f"\nNeed to add (SOL): {(last_reflection_balance - usable_balance) / 1e9}")
