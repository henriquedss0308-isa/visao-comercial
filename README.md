# Visão Comercial

Dashboard web para pequenos negócios acompanharem **vendas**, **faturamento**, **produtos** e **desempenho comercial**.

Aplicação **100% front-end**: HTML, CSS e JavaScript puros, com gráficos via [Chart.js](https://www.chartjs.org/) (CDN). Os dados ficam apenas no `localStorage` do navegador — **nada é enviado a servidores**.

> **Demonstração:** os registros iniciais são **fictícios e locais**, gerados para explorar o painel. Você pode cadastrar vendas reais no seu navegador ou importar um CSV.

---

## Funcionalidades

### Indicadores (KPIs)
- Faturamento total  
- Número de vendas  
- Ticket médio  
- Produto mais vendido (por quantidade)  
- Categoria mais rentável (por faturamento)  
- Melhor vendedor / canal  
- Variação percentual em relação ao **período anterior** (mesma duração)  
- Meta mensal e percentual atingido no mês civil atual  

### Gráficos
- Faturamento por dia  
- Comparação com o período anterior  
- Vendas por produto  
- Vendas por categoria  
- Formas de pagamento  
- Desempenho por vendedor / canal  

### Filtros
- Hoje · Últimos 7 dias · Últimos 30 dias · Mês atual · Período personalizado  
- Produto · Categoria · Forma de pagamento · Vendedor / canal  

Cards, gráficos e tabela usam **o mesmo conjunto de dados filtrados**. A pesquisa da tabela é um refinamento adicional só na listagem.

### Vendas (CRUD)
- Cadastro, edição e exclusão  
- Pesquisa, ordenação e paginação  
- Campos: data, cliente, produto, categoria, quantidade, valor unitário, valor total, pagamento, vendedor/canal  

### CSV
- Importar vendas com validação de cabeçalhos e valores  
- **Importação parcial silenciosa não é permitida** — se houver erro, nada é importado  
- Mensagens de erro por linha  
- Download de CSV de exemplo  
- Exportação do conjunto filtrado atual (UTF-8 com BOM)  

### Dados locais
- Persistência em `localStorage`  
- Restaurar dados de demonstração  
- Apagar todos os dados (com confirmação)  
- Configurar meta mensal  

---

## Estrutura do projeto

```
/
├── index.html          # Página principal
├── css/
│   └── styles.css      # Estilos do dashboard
├── js/
│   └── main.js         # Lógica, dados, gráficos e CSV
├── README.md
├── vercel.json         # Deploy na Vercel (estático)
└── netlify.toml        # Deploy na Netlify (estático)
```

---

## Como executar localmente

Não há build nem dependências de Node para rodar o app.

### Opção 1 — abrir o arquivo
Abra `index.html` no navegador.  
(Alguns navegadores restringem módulos locais; se os gráficos não carregarem por CDN offline, use um servidor local.)

### Opção 2 — servidor local simples

**Python**
```bash
python -m http.server 5500
```

**Node (npx)**
```bash
npx serve .
```

**VS Code / Cursor**  
Extensão “Live Server” na pasta do projeto.

Acesse `http://localhost:5500` (ou a porta indicada).

---

## Deploy

Projeto estático — qualquer host de arquivos estáticos funciona.

### Vercel
1. Importe o repositório no [Vercel](https://vercel.com).  
2. Framework Preset: **Other**.  
3. Build Command: *(vazio)*.  
4. Output Directory: `.` (raiz).  
5. Deploy. O arquivo `vercel.json` já define o comportamento estático.

### Netlify
1. Importe o repositório no [Netlify](https://www.netlify.com).  
2. Build command: *(vazio)*.  
3. Publish directory: `.`  
4. O arquivo `netlify.toml` já está configurado.

### GitHub Pages
1. Publique o repositório no GitHub.  
2. **Settings → Pages → Source**: branch `main` (ou `master`), pasta `/ (root)`.  
3. Aguarde o deploy e abra a URL `https://<usuario>.github.io/<repositorio>/`.

> Se o site for servido em subcaminho (`/repo/`), os caminhos relativos de `css/` e `js/` já funcionam sem ajuste.

---

## Formato do CSV

Cabeçalhos obrigatórios (nessa ordem conceitual; a ordem das colunas no arquivo pode variar desde que os nomes existam):

```text
data,cliente,produto,categoria,quantidade,valor_unitario,forma_pagamento,vendedor
```

| Coluna | Exemplo | Regras |
|--------|---------|--------|
| `data` | `2026-07-15` ou `15/07/2026` | Data válida |
| `cliente` | `Ana Souza` | Obrigatório |
| `produto` | `Fone Bluetooth Pro` | Obrigatório |
| `categoria` | `Eletrônicos` | Obrigatório |
| `quantidade` | `2` | Inteiro ≥ 1 |
| `valor_unitario` | `189.90` ou `189,90` | Número > 0 |
| `forma_pagamento` | `PIX` | Obrigatório |
| `vendedor` | `Instagram` | Obrigatório |

O **valor total** é sempre calculado como `quantidade × valor_unitario` (não precisa estar no CSV).

Separadores aceitos: `,` ou `;`. Encoding recomendado: UTF-8.

---

## Coerência dos indicadores

O painel calcula métricas a partir de **uma única lista filtrada**:

- **Faturamento** = soma de `total` de cada venda filtrada  
- **Nº de vendas** = quantidade de registros filtrados  
- **Ticket médio** = faturamento ÷ nº de vendas  
- Gráficos de categoria, pagamento, vendedor e produto somam o mesmo faturamento  
- O gráfico diário soma o faturamento de todos os dias do intervalo (dias sem venda = 0)  
- O **período anterior** tem a mesma duração e termina no dia anterior ao início do período atual  
- A **meta mensal** usa o faturamento do mês civil atual (com os mesmos filtros de dimensão: produto, categoria, etc.)

Após carregar a página, o console do navegador registra um auto-teste de coerência (`[Visão Comercial] Coerência OK …`).

---

## Privacidade

- Sem backend e sem analytics embutidos.  
- Sem integrações bancárias ou de marketplaces.  
- Dados apenas no dispositivo do usuário (`localStorage`).  
- Limpar dados do site no navegador remove as vendas salvas.

---

## Acessibilidade e UX

- Hierarquia visual clara e paleta sóbria (slate + teal)  
- Navegação por teclado e `focus-visible`  
- Link “Ir para o conteúdo principal”  
- Modais com foco e tecla `Esc`  
- Estados vazios, toasts de sucesso/erro e tooltips nos gráficos  
- Layout responsivo para mobile  

---

## Tecnologias

| Tecnologia | Uso |
|------------|-----|
| HTML5 | Estrutura semântica |
| CSS3 | Layout, tema e responsividade |
| JavaScript (ES6+) | Estado, filtros, CRUD, CSV |
| Chart.js 4 (CDN) | Gráficos |
| localStorage | Persistência local |

---

## Licença

Projeto demonstrativo — use e adapte livremente para fins educacionais ou internos.
