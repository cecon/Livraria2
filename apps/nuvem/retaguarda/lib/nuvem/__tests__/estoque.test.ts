import { expect, test } from 'vitest';
import { navigation } from '@/interface/able-pro/navigation';
test('retaguarda oferece gestao de estoque sem revisao descontinuada',()=>{
 const paths=navigation.flatMap(group=>group.items.map(item=>item.href));
 expect(paths).toContain('/inventario');
 expect(paths).toContain('/lancamentos');
 expect(paths).not.toContain('/estoque/divergencias');
 expect(new Set(paths).size).toBe(paths.length);
});
