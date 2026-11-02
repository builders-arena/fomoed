import Link from 'next/link';
import { FEE_SPLIT_BPS } from '@float/core/constants';

export default function HomePage(): JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 py-10 text-center">
        <h1 className="text-4xl font-bold">Coins that pay their holders.</h1>
        <p className="mx-auto max-w-2xl text-muted">
          Launch a coin paired with SOL, USDC or a tokenized stock. Every trade&apos;s fee is split
          back: {FEE_SPLIT_BPS.HOLDERS / 100}% to holders, {FEE_SPLIT_BPS.CREATOR / 100}% to the
          creator, {FEE_SPLIT_BPS.FLAGSHIP / 100}% to the flagship buyback,{' '}
          {FEE_SPLIT_BPS.TRADERS / 100}% to a trader airdrop, {FEE_SPLIT_BPS.TREASURY / 100}% to the
          treasury.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/tokens" className="btn">
            Explore tokens
          </Link>
          <Link href="/create" className="btn-ghost">
            Launch a coin
          </Link>
        </div>
      </section>
    </div>
  );
}
