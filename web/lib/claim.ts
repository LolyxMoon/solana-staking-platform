import toast from "react-hot-toast";

export async function claimRewards(poolName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const isError = Math.random() < 0.2; // 20% chance fail
      if (isError) {
        reject(new Error(`Claim failed for ${poolName}`));
      } else {
        resolve();
      }
    }, 1500);
  });
}
