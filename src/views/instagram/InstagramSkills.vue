<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

// ponytail: guia estático das skills instaladas em ~/.claude/skills/ig-*; elas rodam no Claude Code, não no backend
type Skill = {
    command: string
    icon: string
    summary: string
    when: string
    needsPython?: boolean
    example: string
}

const SKILLS: Skill[] = [
    {
        command: '/ig-reel',
        icon: 'mdi:movie-open-outline',
        summary: 'Transforma uma ideia em Reel: 3 ganchos de 26 fórmulas com nota, roteiro falado, texto na tela e beat sheet com tempo.',
        when: '"faz um reel sobre X", "o que eu falo nesse vídeo", vai gravar e não tem a primeira frase.',
        needsPython: true,
        example: `HOOKS  (scored)
  86  STRONG  #5  Time Collapse   "Proposals used to take me five hours. Twenty minutes now."
                                  on screen: 5 HOURS -> 20 MIN
  71  STRONG  #1  Cost Confession "I billed four hours a week for formatting. For two years."
  54  OK      #9  The Steal       "Steal the proposal template that did it."

REEL READY
hook:       #3 Nobody Tells You, scored 86 STRONG
length:     28.4s across 9 beats at 165 wpm
on-screen:  6 cards
humanizer:  4 artefacts stripped, human score 81 PASS`,
    },
    {
        command: '/ig-viral',
        icon: 'mdi:fire',
        summary: 'Pesquisa reels que estão funcionando no nicho e ranqueia pelo múltiplo sobre a mediana da própria conta, não por views brutas.',
        when: '"o que tá funcionando agora", "faz um swipe file", "por que esse reel bombou". Rodar 1x por mês.',
        needsPython: true,
        example: `SWIPE  ·  38 reels  ·  7 accounts  ·  baseline: account median

OUTLIERS (above 3x)
  38.4x  hook 86  #3  Nobody Tells You   @acct_a    412,000  (median 10,700)
  11.2x  hook 79  #9  The Steal          @acct_c    180,000  (median 16,100)

WHAT IS OVER-INDEXING
  #3 Nobody Tells You   x5 in the top third, 0 in the bottom
  median hook length    8 words up top, 19 at the bottom`,
    },
    {
        command: '/ig-caption',
        icon: 'mdi:text-box-outline',
        summary: 'Escreve a legenda e passa no linter: mostra os 125 caracteres que o feed exibe antes do "... mais", máx. 5 hashtags, uma chamada só.',
        when: '"escreve a legenda", "o que eu ponho na descrição", dúvida sobre hashtag.',
        needsPython: true,
        example: `  WHAT THE FEED SHOWS
  +------------------------------------------------------+
  | I lost $18,000 because of one missing clause in a    |
  | contract, and the worst part is that I had read the  |
  | thing twice before I si                              |
  +-------------------------------------------- ... more +

  PASS  LENGTH            389 / 2200 characters
  WARN  FIRST LINE        133 characters, so it gets cut at 125 mid-thought
  PASS  HASHTAGS          3 tags
  PASS  ONE ASK           one call to action: comment a keyword`,
    },
    {
        command: '/ig-human',
        icon: 'mdi:account-voice',
        summary: 'Humanizador: tira travessão, vocabulário de IA e caracteres invisíveis, depois dá nota em 5 checagens. As outras skills passam por ele antes de te mostrar.',
        when: '"isso parece IA?", "tira os travessões", antes de qualquer texto sair.',
        needsPython: true,
        example: `  BURSTINESS    ###################.....  78.4
  SPECIFICITY   #############...........  53.6
  SLOP DENSITY  ........................   0.0    20 stock terms
  FINGERPRINT   ################........  68.7    1 em dash
  VOICE         #################.......  70.0    9 structural tells
  ------------------------------------------------------------
  HUMAN SCORE   ########................  32.5   FLAGGED

  depois do humanize.py:
  HUMAN SCORE   ###################.....  79.7   PASS    (+47.2)`,
    },
    {
        command: '/ig-carousel',
        icon: 'mdi:view-carousel-outline',
        summary: 'Carrossel: capa de até 6 palavras, copy slide a slide, recap pra print, CTA, e depois gera os arquivos 1080x1350.',
        when: '"faz um carrossel", ideia em formato de lista ou passo a passo.',
        example: `CAROUSEL  ·  8 slides

1  COVER   THE $18,000 CLAUSE
           One line I now put in every contract.
2  STAKE   I approved the work. They asked for the money back nine days later.
3          WHAT IT SAYS
           Payment on delivery, not on approval.
7  RECAP   All four lines, in order.
8  CTA     Comment CONTRACT and I will send the full clause.`,
    },
    {
        command: '/ig-story',
        icon: 'mdi:cellphone-play',
        summary: 'Sequência de stories do dia (3 a 7 frames), qual sticker usar em cada um e o funil de DM que começa com a pessoa respondendo.',
        when: '"o que posto no story", "ideia de enquete", vender sem fazer post.',
        example: `STORIES  ·  Tuesday  ·  5 frames

1  [selfie, walking]      "Third refund request this year. Same reason."
2  [screen recording]     the clause, highlighted
3  [talking]              "Approval is a feeling. Delivery is a date."
4  [poll]                 "Have you been burned by a late approval?"  Yes / Not yet
5  [text on photo]        "Reply and I will send you the clause."`,
    },
    {
        command: '/ig-profile',
        icon: 'mdi:card-account-details-outline',
        summary: 'Dá nota de 0 a 100 no perfil (rubrica de 12 itens: nome, bio, link, destaques, fixados, grid) e reescreve na ordem do que mais perde ponto.',
        when: '"melhora minha bio", "por que ninguém segue", cola print do perfil.',
        example: `PROFILE SCORE  38/100

  name field       2/12   name only, no words anyone searches
  bio first line   3/12   three nouns and a coffee emoji
  pinned three     0/10   nothing pinned
  highlights       2/8    "Random", "Life", "2023"
  grid legibility  4/8    six of nine covers are a face mid-sentence`,
    },
    {
        command: '/ig-plan',
        icon: 'mdi:calendar-week',
        summary: 'Plano da semana: o que postar, formato, horário, fórmula de gancho, e 10 contas pra engajar (5 alcance, 3 pares, 2 compradores).',
        when: '"planeja minha semana", "não sei o que postar", calendário de conteúdo.',
        example: `WEEK OF SEP 15

MON  engage only  (20 min, list below)
TUE  7:30pm  REEL      PROOF    #5  Time Collapse   - 5hr proposal to 20 min
WED  stories only + engage
THU  7:00pm  CAROUSEL  TEACH    Job B caption       - the 4-slide clause breakdown
FRI  7:30pm  REEL      OPINION  #2  Negative Command - stop doing discovery calls
SUN  6:00pm  REEL      STORY    #21 Mid-Sentence    - the refund email`,
    },
    {
        command: '/ig-comment',
        icon: 'mdi:comment-text-outline',
        summary: 'Comentários em posts dos outros, escolhendo entre 9 tipos pelo que o post é. Nunca "🔥🔥🔥" nem "ótimo post".',
        when: 'cola o post de alguém e quer comentar, rodada diária de engajamento.',
        example: `COMMENT OPTIONS  (on @acct's reel about pricing)

[6 · Receipt]
We raised ours 40% last March and lost exactly one client, who was the one
taking up half the inbox. Took eight months to stop being scared of it.

[3 · Respectful disagree]
Agree on the anchoring. The part I would push back on is doing it mid-project.

Post the first. It concedes something and it has a number in it.`,
    },
    {
        command: '/ig-reply',
        icon: 'mdi:reply-all-outline',
        summary: 'Respostas aos comentários dos seus posts: separa em palavra-chave / lead / conteúdo / pergunta / apoio / ruído e responde nessa ordem.',
        when: 'cola os comentários de um post, "responde esses", lidar com hater ou lead.',
        example: `REPLIES  ·  84 comments  ·  41 KEYWORD, 2 LEAD, 3 SUBSTANCE, 2 QUESTION, 34 SUPPORT, 2 NOISE

LEAD
@handle - "we had this exact thing happen in June"
> The bit that fixed it for us was moving the payment trigger off approval.

QUESTION -> REEL
@handle - "what do you do if they refuse to sign it?"
  34 likes on this comment. That is a Reel, not a reply. Formula #16.

NOISE  (2)  skipped. Replying gives them reach.`,
    },
    {
        command: '/ig-dm',
        icon: 'mdi:message-text-outline',
        summary: 'DMs: entrega da palavra-chave, primeira mensagem pra quem interagiu, proposta de collab e os 2 follow-ups (+4 e +10 dias).',
        when: '"o que mando pra ele", "proposta pra marca", "como faço follow-up".',
        example: `{nome}, aqui está: {o link ou a coisa}.

{uma linha de como usar}

{uma pergunta que dá pra responder em quatro palavras}

follow-up +4 dias:  algo novo, nunca "só subindo isso"
follow-up +10 dias: fecha o ciclo e para`,
    },
    {
        command: '/ig-repurpose',
        icon: 'mdi:recycle',
        summary: 'Pega um conteúdo longo (vídeo, live, podcast, texto) e tira uma semana de reels e carrosséis independentes.',
        when: '"transforma isso em reels", cola uma transcrição ou texto longo.',
        example: `SOURCE: "Why we killed discovery calls" (42 min podcast, 8,900 words)

FOUND  5 claims, 9 numbers, 3 stories, 4 mechanisms, 2 mistakes, 7 quotable lines

WEEK
TUE  REEL      #2  Negative Command  Stop running discovery calls
WED  CAROUSEL  Job B caption         The 4-question form that replaced the call
FRI  REEL      #21 Mid-Sentence      "...and he asked for a refund nine days later"`,
    },
    {
        command: '/ig-audit',
        icon: 'mdi:clipboard-search-outline',
        summary: 'Análise do que já foi postado: ranqueia por múltiplo sobre a mediana e envios por alcance, e diz o que parar de fazer.',
        when: 'cola os insights/prints dos posts, "o que tá funcionando", "por que esse flopou".',
        example: `AUDIT  ·  31 posts  ·  Jun 12 - Sep 5  ·  median views 4,100

TOP 5 BY OUTLIER MULTIPLE
  18.2x  #3  Nobody Tells You   74,600 views  62% non-follower  hold@3s 71%  128 sends

WHAT THE DATA SAYS
1. Hold at 3 seconds is the whole story. Top five average 66%, bottom five 33%.
3. Tool listicles get views and nothing else.

STOP: listicles.
DO MORE: the ones with a cost you paid and a number attached.`,
    },
]

const openCommand = ref<string | null>(null)

const toggle = (command: string) => {
    openCommand.value = openCommand.value === command ? null : command
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Skills de Instagram</h1>
                <p class="page-subtitle">
                    12 comandos instalados no Claude Code. Eles escrevem, você posta: nenhum publica nada no Instagram.
                </p>
            </div>
        </header>

        <section class="panel">
            <h2 class="panel-title">Como usar</h2>
            <p class="panel-hint">
                No chat do Claude Code, digite o comando seguido da ideia, ex.:
                <code>/ig-reel arcana nova do Pudge chegou na loja</code>.
                Antes, vale preencher <code>~/.claude/instagram/voice.md</code> (modelo em <code>voice.template.md</code>):
                todas as skills leem esse arquivo pra escrever com a voz da Secret Shop.
            </p>
            <p class="panel-hint" style="margin: 0">
                <span class="badge badge--warn">Python</span>
                As marcadas precisam de Python, que ainda não está instalado nesta máquina. Sem ele, a nota do gancho,
                o tempo do roteiro, o linter de legenda e o humanizador não rodam; o texto sai mesmo assim.
            </p>
        </section>

        <div class="skills-grid">
            <article
                v-for="skill in SKILLS"
                :key="skill.command"
                class="panel skill"
                :class="{ 'skill--open': openCommand === skill.command }"
            >
                <button class="skill-head" @click="toggle(skill.command)">
                    <Icon :icon="skill.icon" class="skill-icon" />
                    <code class="skill-command">{{ skill.command }}</code>
                    <span v-if="skill.needsPython" class="badge badge--warn">Python</span>
                    <Icon :icon="openCommand === skill.command ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="muted" />
                </button>
                <p class="skill-summary">{{ skill.summary }}</p>
                <p class="skill-when"><span class="muted">Quando:</span> {{ skill.when }}</p>
                <div v-if="openCommand === skill.command">
                    <small class="muted">Exemplo de saída (do autor, em inglês)</small>
                    <pre class="skill-example">{{ skill.example }}</pre>
                </div>
            </article>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
@import '../affiliates/affiliates.styl'

code
    background rgba(255,255,255,0.06)
    padding 1px 6px
    border-radius 4px
    font-size 0.8rem
    color #c7d2fe

.skills-grid
    display grid
    grid-template-columns repeat(auto-fill, minmax(340px, 1fr))
    gap 1rem
    align-items start

.skill
    margin 0

.skill--open
    grid-column 1 / -1

.skill-head
    display flex
    align-items center
    gap 0.6rem
    width 100%
    background none
    border none
    padding 0
    cursor pointer
    color inherit
    text-align left

.skill-icon
    font-size 1.3rem
    color #818cf8

.skill-command
    font-size 0.95rem
    font-weight 700
    margin-right auto

.skill-summary
    margin 0.75rem 0 0.5rem
    font-size 0.85rem
    color #e2e8f0

.skill-when
    margin 0 0 0.25rem
    font-size 0.78rem
    color #94a3b8

.skill-example
    margin 0.4rem 0 0
    padding 0.9rem
    background #0d0d0f
    border 1px solid rgba(255,255,255,0.06)
    border-radius 8px
    font-size 0.75rem
    line-height 1.5
    color #cbd5e1
    overflow-x auto
</style>
