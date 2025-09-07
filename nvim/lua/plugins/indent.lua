return {
    "nvimdev/indentmini.nvim",
    config = function()
        vim.cmd.highlight('IndentLine guifg=#44475a')
        vim.cmd.highlight('IndentLineCurrent guifg=#50fa7b')
        require("indentmini").setup() -- use default config
    end,
}
