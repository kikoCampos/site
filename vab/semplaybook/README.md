# Sem Playbook · plataforma do encontro VAB de 21 de outubro

Três páginas e um script. Sem servidor próprio, sem instalação.

| Página | Quem abre | Endereço |
| --- | --- | --- |
| `index.html` | cada participante, no celular (QR code na tela de chegada) | kikocampos.com/vab/semplaybook/ |
| `telao.html` | notebook ligado ao projetor, em tela cheia (tecla **F**) | …/telao.html |
| `painel.html` | a Camila, em outro notebook ou tablet | …/painel.html?k=SENHA |

Enquanto `ENDPOINT` em `sp.js` estiver vazio, tudo roda em **modo demonstração** dentro do mesmo navegador (os dados ficam no localStorage; abra as três páginas em abas do mesmo navegador para ensaiar). O botão "Carregar 5 mesas de teste" do painel só existe nesse modo.

## Implantação (30 minutos, uma vez)

1. **Planilha.** Crie uma planilha Google chamada `Sem Playbook · VAB`. Extensões → Apps Script. Apague o conteúdo e cole `Code.gs`. Salve.
2. **Propriedades.** Na engrenagem do Apps Script (Configurações do projeto → Propriedades do script), crie:
   - `ANTHROPIC_KEY` = chave da API do modelo
   - `OPERATOR_TOKEN` = uma senha curta para o painel (ex.: `vab2110`)
   - `MODEL` (opcional) = identificador do modelo; o padrão está no topo de `Code.gs`
3. **Abas.** No editor, escolha a função `setup` e clique em Executar (autorize). Isso cria as abas `config`, `inscritos`, `checkin`, `votos`, `recomendacoes`, `pos`, `colheita`, `joao`, `caso`.
4. **Caso.** Na aba `caso`, célula A2, cole o texto integral do Caso (A). É daqui que o João lê.
5. **Publicar.** Implantar → Nova implantação → tipo "App da Web" → Executar como **eu** → Quem tem acesso **Qualquer pessoa** → Implantar. Copie a URL que termina em `/exec`.
6. **Ligar.** Em `sp.js`, cole a URL em `const ENDPOINT = "..."`. Suba no GitHub. Pronto.

Para republicar depois de mudar `Code.gs`: Implantar → Gerenciar implantações → editar → Nova versão. A URL não muda.

## Antes do dia 21

- **Inscritos e mesas (20 out).** Na ferramenta de learning agility, gere as mesas e baixe o CSV. Cole as colunas na aba `inscritos` (mesmas colunas: Grupo, Nome, E-mail, Empresa, Função, Papel sugerido, Picos). O número da mesa vem de `Grupo`. Em `config`, ajuste `n_mesas`.
- **Voz do João.** No telão, tecla **V** abre a configuração: cole a chave da ElevenLabs e o `voice id` escolhido (modelo `eleven_multilingual_v2`). Teste. Se ficar vazio ou falhar, o telão usa a voz pt-BR do próprio navegador. A chave fica só naquele notebook.
- **Primeiro clique.** Navegador só toca áudio depois de um clique na página: clique uma vez no telão antes de começar.
- **Ensaio (19 out).** Painel → "Zerar rodada (ensaio)" apaga tudo o que a rodada produziu e mantém os inscritos.

## A noite, pelo painel

Os 14 passos da sequência correspondem ao roteiro do plano. Cada "Ir" muda ao mesmo tempo a tela do celular e a do telão; os passos com cronômetro mostram a contagem no telão.

O João tem três botões: conjunto, reviravolta e mesa. Gerar não toca: o texto aparece no painel para a Camila ler, corrigir se precisar (máximo de 120 palavras) e só então "Tocar no telão". O telão toca uma vez e mantém a legenda. "Gerar de novo" descarta e refaz. Tocar a reviravolta abre automaticamente o Ato 2 no celular, com 15 minutos.

## Plano B

- Modelo falha: o painel mostra o erro; use "Gerar de novo" ou leia uma das quatro respostas reserva do documento do conselheiro, de viva voz.
- Voz falha: o telão cai para a voz do navegador; se também falhar, a legenda fica na tela e o Kiko lê.
- Celular de uma mesa não envia: a mesa escreve na folha A4 e a Camila digita em `index.html?sair=1` (zera a identidade do aparelho) escolhendo um nome daquela mesa.
- Planilha fora do ar: nada é perdido no celular (rascunhos ficam salvos no aparelho); reenviar quando voltar.

## Dados que ficam

Tudo está na planilha, aba por aba. Para o checklist da comunidade e o Board Hack de 2027: `recomendacoes` (com os dois riscos), `pos`, `colheita` e `joao` (o que o conselheiro disse).
