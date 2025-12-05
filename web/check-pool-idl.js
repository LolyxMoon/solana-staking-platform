const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

async function check() {
  const conn = new Connection('https://api.mainnet-beta.solana.com');
  const mint = new PublicKey('9VxExA1iRPbuLLdSJ2rB3nyBxsyLReT4aqzZBMaBaY1p');
  const programId = new PublicKey('gLHaGJsZ6G7AXZxoDL9EsSWkRbKAWhFHi73gVfNXuzK');
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync('./lib/staking_program.json', 'utf8'));
  const program = new anchor.Program(idl, programId, new anchor.AnchorProvider(conn, {}, {}));
  
  for (let poolId = 0; poolId <= 2; poolId++) {
    try {
      const poolIdBytes = Buffer.from(new Uint8Array(new BigUint64Array([BigInt(poolId)]).buffer));
      const [projectPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('project'), mint.toBuffer(), poolIdBytes],
        programId
      );
      
      const project = await program.account.project.fetch(projectPDA);
      
      console.log('\n=== POOL', poolId, '===');
      console.log('Total Rewards:', project.totalRewardsDeposited.toNumber() / 1e9, 'tokens');
      console.log('Total Staked:', project.totalStaked.toNumber() / 1e9, 'tokens');
      console.log('Pool Duration:', project.poolDurationSeconds.toNumber(), 'seconds =', project.poolDurationSeconds.toNumber() / 86400, 'days');
      console.log('Rate Mode:', project.rateMode);
      console.log('Stored rewardRatePerSecond:', project.rewardRatePerSecond.toNumber());
      console.log('Expected (totalRewards / duration):', Math.floor(project.totalRewardsDeposited.toNumber() / project.poolDurationSeconds.toNumber()));
      
      const expected = Math.floor(project.totalRewardsDeposited.toNumber() / project.poolDurationSeconds.toNumber());
      const actual = project.rewardRatePerSecond.toNumber();
      console.log('Multiplier:', actual / expected);
    } catch (e) {
      console.log('Pool', poolId, 'not found');
    }
  }
}

check().catch(console.error);
