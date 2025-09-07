return {
    "lukas-reineke/indent-blankline.nvim",
    main = "ibl",
    opts = {},
    config = function()
        local hooks = require("ibl.hooks")
        hooks.register(hooks.type.HIGHLIGHT_SETUP, function()
            vim.api.nvim_set_hl(0, "DraculaIndent", { fg = "#ab6a9c" })
        end)

        require("ibl").setup({
            indent = {
                char = "│",
            },
            scope = {
                enabled = true,
                show_start = false,
                show_end = false,
                highlight = "DraculaIndent",
            },
        })
    end,
}
