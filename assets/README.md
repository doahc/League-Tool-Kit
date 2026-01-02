# Assets Folder

Esta pasta contém recursos estáticos do aplicativo.

## Ícones Necessários

Para builds de produção, você precisará adicionar ícones:

### Windows
- **icon.ico** - Ícone do aplicativo Windows (256x256, .ico format)

### MacOS  
- **icon.icns** - Ícone do aplicativo MacOS (.icns format)

### Linux
- **icon.png** - Ícone do aplicativo Linux (512x512, .png format)

## Como Criar Ícones

### Opção 1: Online (Fácil)
1. Acesse: https://www.favicon-generator.org/
2. Upload sua imagem
3. Download os arquivos gerados

### Opção 2: Manual

**Para .ico (Windows):**
```bash
# Usando ImageMagick
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

**Para .icns (MacOS):**
```bash
# Usando png2icns
png2icns icon.icns icon.png
```

**Para .png (Linux):**
```bash
# Usando ImageMagick
convert icon.png -resize 512x512 icon.png
```

## Estrutura Esperada

```
assets/
├── README.md          # Este arquivo
├── icon.ico           # Windows
├── icon.icns          # MacOS
├── icon.png           # Linux
└── splash.png         # (Opcional) Tela de splash
```

## Tamanhos Recomendados

| Platform | Formato | Tamanhos |
|----------|---------|----------|
| Windows  | .ico    | 16x16, 32x32, 48x48, 256x256 |
| MacOS    | .icns   | 16x16 até 1024x1024 |
| Linux    | .png    | 512x512 |

## Notas

- Se os ícones não existirem, o Electron usará ícones padrão
- Para produção, é **altamente recomendado** adicionar ícones customizados
- Mantenha os arquivos nesta pasta para referência

## Design Sugestões

- Use cores vibrantes relacionadas ao LoL (azul, dourado)
- Torne o ícone reconhecível mesmo em tamanhos pequenos
- Evite texto (fica ilegível em 16x16)
- Use transparência quando apropriado
