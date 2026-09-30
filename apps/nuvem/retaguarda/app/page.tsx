"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Alert,Avatar,Box,Button,Card,CardContent,Chip,Grid,Skeleton,Stack,ToggleButton,ToggleButtonGroup,Typography} from '@mui/material';
import {BookOpenCheck,BookPlus,CircleDollarSign,FileBarChart,Package,ReceiptText,Search,ArrowUpRight,RefreshCw} from 'lucide-react';
import {ContentPanel} from '@/components/ContentPanel';
import {PageLayout} from '@/components/PageLayout';
import {PageHeader} from '@/components/PageHeader';
import {Cover} from '@/components/Cover';
import {StockBadge} from '@/components/StockBadge';
import {dashboard,type DashboardDia,type PeriodoDash} from '@/lib/nuvem/dashboard';
import {reais} from '@/utils/texto';
const periods:{id:PeriodoDash;label:string}[]=[{id:'hoje',label:'Hoje'},{id:'7dias',label:'7 dias'},{id:'mes',label:'Este mês'},{id:'ano',label:'Este ano'}];
const actions=[{href:'/cadastro',label:'Catálogo de livros',description:'Produtos, preços e imagens',icon:BookPlus},{href:'/lancamentos',label:'Entrada de estoque',description:'Receba e confira os títulos',icon:Package},{href:'/pesquisa',label:'Pesquisar um livro',description:'Consulte preço e disponibilidade',icon:Search},{href:'/relatorios',label:'Relatórios',description:'Acompanhe os resultados',icon:FileBarChart}];
export default function Inicio(){
 const [data,setData]=useState<DashboardDia|null>(null);const [period,setPeriod]=useState<PeriodoDash>('hoje');
 const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');dashboard(period).then(value=>{if(active)setData(value);}).catch(()=>{if(active)setError('Não foi possível carregar os indicadores. Tente novamente.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[period,attempt]);
 const metrics=[{label:'Total em vendas',value:reais(data?.vendasCentavos??0),icon:CircleDollarSign,color:'primary'},
 {label:'Itens vendidos',value:(data?.itensVendidos??0).toLocaleString('pt-BR'),icon:BookOpenCheck,color:'success'},
 {label:'Ticket médio',value:reais(data?.ticketMedioCentavos??0),icon:ReceiptText,color:'warning'},
 {label:'Unidades em estoque',value:(data?.totalEstoque??0).toLocaleString('pt-BR'),icon:Package,color:'info'}];
 return <PageLayout size="lg">
  <PageHeader title="Visão geral" description="Acompanhe a operação e os resultados da livraria." crumbs={[{label:'Visão geral'}]}
   action={<ToggleButtonGroup size="small" exclusive value={period} onChange={(_,value)=>{if(value)setPeriod(value);}} aria-label="Período dos indicadores">{periods.map(p=><ToggleButton key={p.id} value={p.id}>{p.label}</ToggleButton>)}</ToggleButtonGroup>}/>
  {error&&<Alert severity="error" action={<Button size="small" onClick={()=>setAttempt(v=>v+1)} startIcon={<RefreshCw size={16}/>}>Tentar novamente</Button>}>{error}</Alert>}
  <Grid container spacing={3}>{metrics.map(({label,value,icon:Icon,color})=><Grid key={label} item xs={12} sm={6} lg={3}>
   <Card variant="outlined" sx={{height:'100%',borderRadius:2}}><CardContent sx={{p:3}}><Stack direction="row" justifyContent="space-between" alignItems="center">
    <Avatar variant="rounded" sx={{bgcolor:`${color}.lighter`,color:`${color}.main`,width:44,height:44}}><Icon size={24}/></Avatar>
    <Typography variant="caption" color="text.secondary">{label.includes('estoque')?'Saldo atual':periods.find(p=>p.id===period)?.label}</Typography>
   </Stack><Typography variant="h3" component="p" sx={{mt:2,mb:.5,fontVariantNumeric:'tabular-nums'}}>{loading?<Skeleton width="65%"/>:error?'—':value}</Typography>
   <Typography color="text.secondary">{label}</Typography></CardContent></Card>
  </Grid>)}</Grid>
  <Grid container spacing={3}><Grid item xs={12} lg={8}>
   <ContentPanel title="Atenção ao estoque" description="Títulos com poucas unidades disponíveis" toolbar={<Button component={Link} href="/inventario" size="small" endIcon={<ArrowUpRight size={16}/>}>Ver inventário</Button>}>
    {loading?<Stack spacing={2}>{[1,2,3].map(i=><Skeleton key={i} height={54}/>)}</Stack>:error?<Typography color="text.secondary">Os dados de estoque não estão disponíveis.</Typography>:!data?.estoqueBaixo.length?<Alert severity="success">Nenhum título com estoque baixo.</Alert>:<Stack divider={<Box sx={{borderBottom:'1px solid',borderColor:'divider'}}/>} spacing={1.5}>
     {data.estoqueBaixo.map(book=><Stack key={book.codigo} direction="row" spacing={2} alignItems="center"><Cover titulo={book.titulo} capaUid={book.capaUid} tamanho="sm"/>
      <Box sx={{flex:1,minWidth:0}}><Typography variant="subtitle2">{book.titulo}</Typography><Typography variant="caption" color="text.secondary">{book.autor||book.codigo}</Typography></Box><StockBadge estoque={book.estoque}/></Stack>)}
    </Stack>}
   </ContentPanel>
  </Grid><Grid item xs={12} lg={4}><Stack spacing={3}>
   <ContentPanel title="Resumo do catálogo"><Stack spacing={2}><Box><Typography variant="h3">{loading?<Skeleton width={80}/>:error?'—':data?.totalLivros??0}</Typography><Typography color="text.secondary">títulos cadastrados</Typography></Box><Chip label="Catálogo centralizado" color="primary" variant="outlined" sx={{alignSelf:'flex-start'}}/></Stack></ContentPanel>
   <ContentPanel title="Vendas canceladas"><Typography variant="h3">{loading?<Skeleton width={80}/>:error?'—':data?.canceladasQtd??0}</Typography><Typography color="text.secondary" sx={{mt:1}}>{error?'Dados indisponíveis':reais(data?.canceladasCentavos??0)} no período</Typography><Button component={Link} href="/venda" size="small" sx={{mt:1}}>Consultar vendas</Button></ContentPanel>
  </Stack></Grid></Grid>
  <Box><Typography variant="h5" sx={{mb:2}}>Acesso rápido</Typography><Grid container spacing={2}>{actions.map(({href,label,description,icon:Icon})=><Grid item xs={12} sm={6} lg={3} key={href}>
   <Card variant="outlined" sx={{borderRadius:2,height:'100%'}}><Box component={Link} href={href} sx={{display:'flex',gap:2,p:2.5,color:'inherit',textDecoration:'none','&:hover':{bgcolor:'action.hover'}}}><Icon size={22}/><Box><Typography variant="subtitle1">{label}</Typography><Typography variant="caption" color="text.secondary">{description}</Typography></Box></Box></Card>
  </Grid>)}</Grid></Box>
 </PageLayout>;
}
