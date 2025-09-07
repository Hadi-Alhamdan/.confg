return {
  -- ===================================================================
  --  INSTALLER & BASE CONFIG
  -- ===================================================================
  {
    "williamboman/mason.nvim",
    config = function()
      require("mason").setup()
    end,
  },

  -- ===================================================================
  --  LINTERS AND FORMATTERS (uses none-ls)
  -- ===================================================================

  {
    'nvimtools/none-ls.nvim',
    dependencies = {
      'williamboman/mason.nvim',
      'nvimtools/none-ls-extras.nvim',
      'jayp0521/mason-null-ls.nvim',
    },
    config = function()
      local null_ls = require 'null-ls'
      local formatting = null_ls.builtins.formatting
      local diagnostics = null_ls.builtins.diagnostics

      require('mason-null-ls').setup {
        ensure_installed = {
          'prettier',
          'eslint_d',
          'shfmt',
          'checkmake',
          'stylua',
          'ruff',
        },
        automatic_installation = true,
      }

      local sources = {
        diagnostics.checkmake,
        diagnostics.eslint_d,
        formatting.prettier.with { filetypes = { 'html', 'js', 'python', 'markdown', 'bash' } },
        formatting.stylua,
        formatting.shfmt.with { args = { '-i', '4' } },
        require('none-ls.formatting.ruff').with { extra_args = { '--extend-select', 'I' } },
        require 'none-ls.formatting.ruff_format',
      }

      null_ls.setup {
        sources = sources,
      }

      vim.keymap.set('n', '<leader>f', function()
        vim.lsp.buf.format { async = true }
      end, { desc = 'Format current buffer' })
    end,
  },

  -- ===================================================================
  --  LANGUAGE SERVERS (LSP) -- CORRECTED SECTION
  -- ===================================================================
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      "williamboman/mason.nvim",
      "williamboman/mason-lspconfig.nvim",
    },
    config = function()
      -- This on_attach function is where all our keymaps are defined.
      -- It will be passed to EVERY server.
      local on_attach = function(client, bufnr)
        local nmap = function(keys, func, desc)
          if desc then
            desc = 'LSP: ' .. desc
          end
          vim.keymap.set('n', keys, func, { buffer = bufnr, desc = desc })
        end

        nmap('<leader>rn', vim.lsp.buf.rename, '[R]e[n]ame')
        nmap('<leader>ca', vim.lsp.buf.code_action, '[C]ode [A]ction')
        nmap('gd', vim.lsp.buf.definition, '[G]oto [D]efinition')
        nmap('gr', require('telescope.builtin').lsp_references, '[G]oto [R]eferences')
        nmap('K', vim.lsp.buf.hover, 'Hover Documentation')
        vim.keymap.set('n', '<leader>d', vim.diagnostic.open_float, { desc = 'Show diagnostics' })
        vim.keymap.set('n', '[d', vim.diagnostic.goto_prev, { desc = 'Go to previous diagnostic' })
        vim.keymap.set('n', ']d', vim.diagnostic.goto_next, { desc = 'Go to next diagnostic' })
      end

      -- Get capabilities from nvim-cmp
      local capabilities = require('cmp_nvim_lsp').default_capabilities()
      -- Fix for the position encoding warning
      capabilities.offsetEncoding = { "utf-8", "utf-16" }

      -- Use mason-lspconfig to ensure servers are installed
      require('mason-lspconfig').setup({
        ensure_installed = { "lua_ls", "ts_ls", "pyright", "bashls", "html", "ruff" },
      })
      
      -- NEW, SIMPLER SETUP LOOP
      -- Iterate through the list of servers we want to install
      for _, server_name in ipairs({ "lua_ls", "ts_ls", "pyright", "bashls", "html", "ruff" }) do
        -- Use a protected call to avoid errors if a server isn't found
        pcall(function()
          local lspconfig = require('lspconfig')
          -- Special setup for lua_ls to add custom settings
          if server_name == 'lua_ls' then
            lspconfig.lua_ls.setup({
              on_attach = on_attach,
              capabilities = capabilities,
              settings = {
                Lua = {
                  diagnostics = { globals = { "vim" } },
                  workspace = { checkThirdParty = false },
                },
              },
            })
          else
            -- Default setup for all other servers
            lspconfig[server_name].setup({
              on_attach = on_attach,
              capabilities = capabilities,
            })
          end
        end)
      end
    end,
  },

  -- ===================================================================
  -- AUTOCOMPLETION (uses nvim-cmp)
  -- ===================================================================
  {
    'hrsh7th/nvim-cmp',
    dependencies = {
      {
        'L3MON4D3/LuaSnip',
        build = "make install_jsregexp",
        dependencies = { 'rafamadriz/friendly-snippets' },
      },
      'saadparwaiz1/cmp_luasnip',
      'hrsh7th/cmp-nvim-lsp',
      'hrsh7th/cmp-buffer',
      'hrsh7th/cmp-path',
    },
    config = function()
      local cmp = require 'cmp'
      local luasnip = require 'luasnip'
      require('luasnip.loaders.from_vscode').lazy_load()
      luasnip.config.setup {}

      local kind_icons = { Text = '󰉿', Method = 'm', Function = '󰊕', Constructor = '', Field = '', Variable = '󰆧', Class = '󰌗', Interface = '', Module = '', Property = '', Unit = '', Value = '󰎠', Enum = '', Keyword = '󰌋', Snippet = '', Color = '󰏘', File = '󰈙', Reference = '', Folder = '󰉋', EnumMember = '', Constant = '󰇽', Struct = '', Event = '', Operator = '󰆕', TypeParameter = '󰊄' }

      cmp.setup {
        snippet = {
          expand = function(args)
            luasnip.lsp_expand(args.body)
          end,
        },
        completion = { completeopt = 'menu,menuone,noinsert' },
        mapping = cmp.mapping.preset.insert {
          ['<C-n>'] = cmp.mapping.select_next_item(),
          ['<C-p>'] = cmp.mapping.select_prev_item(),
          ['<C-b>'] = cmp.mapping.scroll_docs(-4),
          ['<C-f>'] = cmp.mapping.scroll_docs(4),
          ['<C-y>'] = cmp.mapping.confirm { select = true },
          ['<CR>'] = cmp.mapping.confirm { select = true }, -- Use Enter to confirm
          ['<C-Space>'] = cmp.mapping.complete {},
          ['<Tab>'] = cmp.mapping(function(fallback)
            if cmp.visible() then
              cmp.select_next_item()
            elseif luasnip.expand_or_locally_jumpable() then
              luasnip.expand_or_jump()
            else
              fallback()
            end
          end, { 'i', 's' }),
          ['<S-Tab>'] = cmp.mapping(function(fallback)
            if cmp.visible() then
              cmp.select_prev_item()
            elseif luasnip.locally_jumpable(-1) then
              luasnip.jump(-1)
            else
              fallback()
            end
          end, { 'i', 's' }),
        },
        sources = {
          { name = 'nvim_lsp' },
          { name = 'luasnip' },
          { name = 'buffer' },
          { name = 'path' },
        },
        formatting = {
          fields = { 'kind', 'abbr', 'menu' },
          format = function(entry, vim_item)
            vim_item.kind = string.format('%s', kind_icons[vim_item.kind])
            vim_item.menu = ({ nvim_lsp = '[LSP]', luasnip = '[Snippet]', buffer = '[Buffer]', path = '[Path]' })[entry.source.name]
            return vim_item
          end,
        },
      }
    end,
  },
}
