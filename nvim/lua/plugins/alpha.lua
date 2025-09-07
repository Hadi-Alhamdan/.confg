return {
    "goolord/alpha-nvim",
    event = "VimEnter",
    config = function()
        local alpha = require("alpha")
        local dashboard = require("alpha.themes.dashboard")
        local colors = {
            purple = "#bd93f9",
            cyan = "#8be9fd",
            green = "#50fa7b",
            comment = "#6272a4",
        }

        vim.api.nvim_set_hl(0, "AlphaHeader", { fg = colors.purple })
        vim.api.nvim_set_hl(0, "AlphaButton", { fg = colors.cyan })
        vim.api.nvim_set_hl(0, "AlphaShortcut", { fg = colors.green })

        dashboard.section.header.val = {
            "                                                     ",
            "  ███╗   ██╗███████╗ ██████╗ ██╗   ██╗██╗███╗   ███╗ ",
            "  ████╗  ██║██╔════╝██╔═══██╗██║   ██║██║████╗ ████║ ",
            "  ██╔██╗ ██║█████╗  ██║   ██║██║   ██║██║██╔████╔██║ ",
            "  ██║╚██╗██║██╔══╝  ██║   ██║╚██╗ ██╔╝██║██║╚██╔╝██║ ",
            "  ██║ ╚████║███████╗╚██████╔╝ ╚████╔╝ ██║██║ ╚═╝ ██║ ",
            "  ╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═══╝  ╚═╝╚═╝     ╚═╝ ",
            "                                                     ",
        }
        dashboard.section.header.opts.hl = "AlphaHeader"

        dashboard.section.buttons.val = {
            dashboard.button("e", "  > New File", "<cmd>ene<CR>"),
            dashboard.button("SPC ff", "󰱼 > Find File", "<cmd>Telescope find_files<CR>"),
            dashboard.button("q", " > Quit NVIM", "<cmd>qa<CR>"),
        }
        dashboard.section.buttons.opts.hl = "AlphaButton"
        dashboard.section.buttons.opts.keymap_hl = "AlphaShortcut"


        dashboard.section.footer.val = "Find your inspiration."
        dashboard.section.footer.opts.hl = "AlphaComment" 
        vim.api.nvim_set_hl(0, "AlphaComment", { fg = colors.comment })


        alpha.setup(dashboard.opts)

        vim.cmd([[autocmd FileType alpha setlocal nofoldenable]])
    end,
}
