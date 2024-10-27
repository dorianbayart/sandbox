


document.addEventListener('alpine:init', () => {
    Alpine.data('settings', () => ({
      theme: 'dark',
      isDarkMode() { return this.theme === 'dark' },
      toggleTheme() { this.theme = (this.isDarkMode() ? 'light' : 'dark') },
    })),

    Alpine.data('dataLinks', () => ({
      links: [
          { title: 'Gallery', url: '#gallery' },
          { title: 'Contact', url: '#contact' },
          { title: 'Links', url: '#links' },
          { title: 'About', url: '#about' }
      ],

      socials: [
          { title: 'Facebook', tag: '@dorianbayart', url: '' },
          { title: 'Twitter', tag: 'dorianbayart', url: '' },
          { title: 'Instagram', tag: '@dorianbayart', url: '' }
      ],
    }))
})
