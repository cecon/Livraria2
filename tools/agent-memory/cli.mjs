import { createProvider } from './provider.mjs';

try {
  const provider = createProvider();
  const [command, ...args] = process.argv.slice(2);
  let result;
  switch (command) {
    case 'health': result = await provider.health(); break;
    case 'recall': result = await provider.recall(args.join(' ')); break;
    case 'remember': result = await provider.remember(JSON.parse(args.join(' '))); break;
    case 'share': result = await provider.share(args[0], args[1] === '--validated', args.slice(2).join(' ')); break;
    case 'forget': result = await provider.forget(args[0], args[1], args.slice(2).join(' ')); break;
    default: throw new Error('Use health, recall, remember, share or forget');
  }
  console.log(JSON.stringify(result));
} catch {
  console.error('Memory operation rejected: check configuration, identity and safe input.');
  process.exitCode = 1;
}
