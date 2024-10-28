'use strict'

// Recursive methods to calculate the Nth Fibonacci's number

// One-liner - Exponential time complexity
const fib = n => (n < 2 ? n : fib(n - 1) + fib(n - 2))

// Optimized with memoization - Linear time complexity
const fibMemo = (n, memo = {}) => {
  if (n < 2) return n
  if (memo[n]) return memo[n]
  return (memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo))
}

// Memoization in Map + async/await - Linear time complexity
const fibMap = async (n, memo = new Map()) => {
  if (n < 2) return n
  if (!memo.has(n)) memo.set(n, await fibMap(n - 1, memo) + await fibMap(n - 2, memo))
  return memo.get(n)
}

// Memoization in Map + async/await + BigInteger - Linear time complexity
const fibBigInt = async (n, memo = new Map()) => {
  if (n < 2) return BigInt(n)
  if (!memo.has(n)) memo.set(n, await fibBigInt(n - 1, memo) + await fibBigInt(n - 2, memo))
  return memo.get(n)
}

// Iterative - Linear time complexity
const fibIter = n => {
  let a = 0, b = 1
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b]
  }
  return a
}
